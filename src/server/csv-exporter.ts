import fs from 'fs'
import path from 'path'
import { PassThrough, type Readable } from 'stream'
import { ZipArchive } from 'archiver'
import {
  EXDReader,
  type ExhHeader,
  type GameSqPackReader,
  Language,
  formatLanguage,
  readExhHeader,
} from '@ffcafe/elpis-sqpack'
import { decodeSeString } from './sqpack-helper'
import { type SchemaManager } from './schema-manager'

export type SupportedExportLang = 'chs' | 'ja' | 'en' | 'de' | 'fr'

export const ALL_SUPPORTED_LANGS: SupportedExportLang[] = [
  'chs',
  'ja',
  'en',
  'de',
  'fr',
]

/**
 * 语言与 Elpis/SqPack 对应枚举映射
 */
const LANG_ENUM_MAP: Record<SupportedExportLang, Language> = {
  chs: Language.ChineseSimplified,
  ja: Language.Japanese,
  en: Language.English,
  de: Language.German,
  fr: Language.French,
}

/**
 * 语言代码在 EXD 文件名中的后缀解析
 */
function resolveExdLangSuffix(
  exh: ExhHeader,
  preferredLang: Language,
): string {
  const lang = exh.languages.includes(preferredLang)
    ? preferredLang
    : exh.languages[0]
  if (lang === undefined || lang === Language.None) {
    return ''
  }
  const code = formatLanguage(lang)
  return code && !code.startsWith('unk(') ? `_${code}` : ''
}

/**
 * 格式化单元格为 RFC 4180 规范的 CSV 文本字段
 * 凡是字符串类型的列，统一前后用双引号包裹
 */
export function formatCsvCell(val: unknown, isStringCol = false): string {
  if (isStringCol) {
    if (val === null || val === undefined) {
      return '""'
    }
    const text = decodeSeString(val)
    return `"${text.replace(/"/g, '""')}"`
  }

  if (val === null || val === undefined) {
    return ''
  }
  if (typeof val === 'boolean') {
    return val ? 'True' : 'False'
  }
  if (typeof val === 'number' || typeof val === 'bigint') {
    return String(val)
  }

  // 若无显式类型但实际为文本 Buffer 或字符串，统一包裹双引号
  if (typeof val === 'string' || Buffer.isBuffer(val)) {
    const text = decodeSeString(val)
    return `"${text.replace(/"/g, '""')}"`
  }
  return String(val)
}

/**
 * 本地解包任务状态
 */
export interface LocalUnpackProgress {
  isRunning: boolean
  isCompleted: boolean
  isCancelled: boolean
  currentSheet: string
  currentLang: string
  processedTasks: number
  totalTasks: number
  percent: number
  errorCount: number
  outputDir: string
  errorMessage?: string
  startTime?: number
  endTime?: number
}

export class CsvExportService {
  private activeUnpackProgress: LocalUnpackProgress | null = null
  private cancelRequested = false

  constructor(
    private readonly cnReader: GameSqPackReader,
    private readonly globalReader: GameSqPackReader,
    public readonly schemaManager: SchemaManager,
  ) {}

  /**
   * 选择对应服务器的 SqPack Reader
   */
  private getReaderForLang(lang: SupportedExportLang): GameSqPackReader {
    return lang === 'chs' ? this.cnReader : this.globalReader
  }

  /**
   * 将单张数据表解包为指定语言的 SaintCoinach 规范 CSV 字符串
   */
  async exportSheetToCsv(
    sheetName: string,
    lang: SupportedExportLang,
  ): Promise<string> {
    const reader = this.getReaderForLang(lang)
    const lowerName = sheetName.toLowerCase()
    const exhBuf = await reader.readFile(`exd/${lowerName}.exh`)
    if (!exhBuf) {
      throw new Error(`找不到数据表头: exd/${lowerName}.exh`)
    }
    const exh = readExhHeader(exhBuf)
    const preferredLang = LANG_ENUM_MAP[lang]
    const langSuffix = resolveExdLangSuffix(exh, preferredLang)

    // 获取并对齐列元数据
    const schemaMeta = await this.schemaManager.getSheetSchema(
      reader,
      sheetName,
    )
    const cols = schemaMeta.columns

    // 生成三行表头（带 UTF-8 BOM）
    const line1 = ['key', ...cols.map((_, i) => String(i))].join(',')
    const line2 = ['#', ...cols.map((c) => c.name)].join(',')
    const line3 = ['int32', ...cols.map((c) => c.type)].join(',')

    const csvLines: string[] = ['\ufeff' + line1, line2, line3]

    // 逐页读取 EXD 数据行
    for (const page of exh.paginations) {
      const exdPath = `exd/${lowerName}_${page.startId}${langSuffix}.exd`
      const exdBuf = await reader.readFile(exdPath)
      if (!exdBuf) continue

      const exd = new EXDReader(exdBuf, exh)
      const rowIds = exd.listRowIds().sort((a, b) => a - b)

      if (exh.variant === 2) {
        // 子行表（Variant = 2）
        for (const rowId of rowIds) {
          const subCount = exd.getSubRowCount(rowId)
          for (let subIdx = 0; subIdx < subCount; subIdx++) {
            const subRow = exd.readSubrow(rowId, subIdx)
            const rowKey = `${rowId}.${subIdx}`
            const cells = cols.map((c) =>
              formatCsvCell(subRow.data[c.index], c.type === 'str'),
            )
            csvLines.push([rowKey, ...cells].join(','))
          }
        }
      } else {
        // 普通表（Variant = 1）
        for (const rowId of rowIds) {
          const rowData = exd.readRow(rowId)
          const cells = cols.map((c) =>
            formatCsvCell(rowData[c.index], c.type === 'str'),
          )
          csvLines.push([String(rowId), ...cells].join(','))
        }
      }
    }

    return csvLines.join('\r\n') + '\r\n'
  }

  /**
   * 将选中的表与语言打包为 zip 数据流
   * 若未指定 sheets 或传空，默认自动提取全量游戏数据表
   */
  createExportZipStream(
    sheets?: string[],
    langs: SupportedExportLang[] = ALL_SUPPORTED_LANGS,
    onProgress?: (current: number, total: number, message: string) => void,
  ): Readable {
    const archive = new ZipArchive({
      zlib: { level: 6 },
    })

    const passThrough = new PassThrough()
    archive.pipe(passThrough)

    ;(async () => {
      try {
        const targetSheets =
          sheets && sheets.length > 0
            ? sheets
            : await this.schemaManager.getAllSheetNames(this.cnReader)

        const totalTasks = targetSheets.length * langs.length
        let completed = 0

        for (const sheet of targetSheets) {
          for (const lang of langs) {
            completed++
            if (onProgress) {
              onProgress(
                completed,
                totalTasks,
                `正在解包 ${sheet} (${lang})...`,
              )
            }
            try {
              const csv = await this.exportSheetToCsv(sheet, lang)
              archive.append(Buffer.from(csv, 'utf8'), {
                name: `${lang}/${sheet}.csv`,
              })
            } catch (err) {
              console.warn(
                `[CsvExporter] 跳过表 ${sheet} (${lang}):`,
                err instanceof Error ? err.message : err,
              )
            }
          }
        }

        await archive.finalize()
      } catch (err) {
        archive.emit('error', err)
      }
    })()

    return passThrough
  }

  /**
   * 获取当前后台本地解包任务的状态
   */
  getLocalUnpackStatus(): LocalUnpackProgress | null {
    return this.activeUnpackProgress
  }

  /**
   * 取消当前运行的本地解包任务
   */
  cancelLocalUnpack(): boolean {
    if (this.activeUnpackProgress?.isRunning) {
      this.cancelRequested = true
      return true
    }
    return false
  }

  /**
   * 直接解包全部 CSV 到用户指定的本地目录
   * 1. 扫描目录下是否存在对应的语言目录（chs, ja等），若有则先递归清理清空；
   * 2. 依次生成 CSV 并直接写入磁盘；
   * 3. 实时汇报任务进度。
   */
  async startUnpackToLocalDirectory(
    outputDir: string,
    langs: SupportedExportLang[] = ALL_SUPPORTED_LANGS,
    sheets?: string[],
  ): Promise<void> {
    if (this.activeUnpackProgress?.isRunning) {
      throw new Error('当前已有解包任务正在执行中，请等待其完成或取消')
    }

    const cleanOutputDir = path.resolve(outputDir.trim())
    if (!cleanOutputDir) {
      throw new Error('未指定有效的本地输出目录')
    }

    // 确保主目录存在
    if (!fs.existsSync(cleanOutputDir)) {
      await fs.promises.mkdir(cleanOutputDir, { recursive: true })
    }

    // 1. 扫描并清理已有语言目录
    for (const lang of langs) {
      const langDir = path.join(cleanOutputDir, lang)
      if (fs.existsSync(langDir)) {
        console.log(`[CsvExporter] 扫描到旧目录 ${langDir}，执行清理...`)
        await fs.promises.rm(langDir, { recursive: true, force: true })
      }
      await fs.promises.mkdir(langDir, { recursive: true })
    }

    const targetSheets =
      sheets && sheets.length > 0
        ? sheets
        : await this.schemaManager.getAllSheetNames(this.cnReader)
    const totalTasks = targetSheets.length * langs.length

    this.cancelRequested = false
    this.activeUnpackProgress = {
      isRunning: true,
      isCompleted: false,
      isCancelled: false,
      currentSheet: '',
      currentLang: '',
      processedTasks: 0,
      totalTasks,
      percent: 0,
      errorCount: 0,
      outputDir: cleanOutputDir,
      startTime: Date.now(),
    }

    // 异步在后台循环执行解包与写盘
    ;(async () => {
      let processed = 0
      let errors = 0

      for (const sheet of targetSheets) {
        if (this.cancelRequested) {
          if (this.activeUnpackProgress) {
            this.activeUnpackProgress.isRunning = false
            this.activeUnpackProgress.isCancelled = true
            this.activeUnpackProgress.endTime = Date.now()
          }
          console.log('[CsvExporter] 本地解包任务已被用户取消')
          return
        }

        for (const lang of langs) {
          if (this.cancelRequested) break

          processed++
          if (this.activeUnpackProgress) {
            this.activeUnpackProgress.currentSheet = sheet
            this.activeUnpackProgress.currentLang = lang
            this.activeUnpackProgress.processedTasks = processed
            this.activeUnpackProgress.percent = Math.floor(
              (processed / totalTasks) * 100,
            )
          }

          try {
            const csv = await this.exportSheetToCsv(sheet, lang)
            const targetFilePath = path.join(
              cleanOutputDir,
              lang,
              `${sheet}.csv`,
            )
            // 确保子目录（如 custom/000 等）已创建
            const parentDir = path.dirname(targetFilePath)
            if (!fs.existsSync(parentDir)) {
              await fs.promises.mkdir(parentDir, { recursive: true })
            }
            await fs.promises.writeFile(targetFilePath, csv, 'utf8')
          } catch (err) {
            errors++
            if (this.activeUnpackProgress) {
              this.activeUnpackProgress.errorCount = errors
            }
            console.warn(
              `[CsvExporter] 解包写入失败: ${sheet} (${lang}):`,
              err instanceof Error ? err.message : err,
            )
          }
        }
      }

      if (this.activeUnpackProgress) {
        this.activeUnpackProgress.isRunning = false
        this.activeUnpackProgress.isCompleted = true
        this.activeUnpackProgress.percent = 100
        this.activeUnpackProgress.endTime = Date.now()
      }
      console.log(
        `[CsvExporter] 全量本地解包完成！输出目录: ${cleanOutputDir}，总耗时: ${(
          ((this.activeUnpackProgress?.endTime || Date.now()) -
            (this.activeUnpackProgress?.startTime || Date.now())) /
          1000
        ).toFixed(1)}s，跳过错误数: ${errors}`,
      )
    })().catch((err) => {
      if (this.activeUnpackProgress) {
        this.activeUnpackProgress.isRunning = false
        this.activeUnpackProgress.errorMessage =
          err instanceof Error ? err.message : String(err)
      }
      console.error('[CsvExporter] 本地解包异常终止:', err)
    })
  }
}
