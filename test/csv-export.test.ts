import fs from 'fs'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GameSqPackReader } from '@ffcafe/elpis-sqpack'
import { loadGamePathsFromEnv } from '../src/server/config'
import { SchemaManager, CORE_SHEET_NAMES } from '../src/server/schema-manager'
import {
  CsvExportService,
  formatCsvCell,
  type SupportedExportLang,
} from '../src/server/csv-exporter'

describe('CSV 解包与 EXDSchema 表头映射测试', () => {
  let cnReader: GameSqPackReader
  let globalReader: GameSqPackReader
  let schemaManager: SchemaManager
  let exporter: CsvExportService
  const testOutputDir = path.resolve(process.cwd(), 'data/test-unpack-output')

  beforeAll(async () => {
    const config = loadGamePathsFromEnv()
    cnReader = new GameSqPackReader(config.cnGamePath)
    globalReader = new GameSqPackReader(config.globalGamePath)
    schemaManager = new SchemaManager()
    exporter = new CsvExportService(cnReader, globalReader, schemaManager)
  })

  afterAll(async () => {
    if (cnReader) await cnReader.close()
    if (globalReader) await globalReader.close()
    if (fs.existsSync(testOutputDir)) {
      await fs.promises.rm(testOutputDir, { recursive: true, force: true })
    }
  })

  it('formatCsvCell 应将字符串类型的列统一前后包裹双引号并转义内部引号', () => {
    // 字符串列
    expect(formatCsvCell('金币', true)).toBe('"金币"')
    expect(formatCsvCell('', true)).toBe('""')
    expect(formatCsvCell(null, true)).toBe('""')
    expect(formatCsvCell(undefined, true)).toBe('""')
    expect(formatCsvCell('Say "Hello"', true)).toBe('"Say ""Hello"""')
    expect(formatCsvCell('Item with, comma', true)).toBe('"Item with, comma"')

    // 非字符串列（数值、布尔）
    expect(formatCsvCell(true, false)).toBe('True')
    expect(formatCsvCell(false, false)).toBe('False')
    expect(formatCsvCell(12345, false)).toBe('12345')
    expect(formatCsvCell(0, false)).toBe('0')
    expect(formatCsvCell(null, false)).toBe('')
  })

  it('SchemaManager 应正确提取 Item 表并在 offset 排序后与 EXH 对齐', async () => {
    const meta = await schemaManager.getSheetSchema(cnReader, 'Item')
    expect(meta.sheetName).toBe('Item')
    expect(meta.columns.length).toBeGreaterThan(80)

    // 验证核心列名与 SaintCoinach 规范完全吻合
    expect(meta.columns[0].name).toBe('Singular')
    expect(meta.columns[1].name).toBe('Adjective')
    expect(meta.columns[2].name).toBe('Plural')
    expect(meta.columns[8].name).toBe('Description')
    expect(meta.columns[9].name).toBe('Name')

    // 验证类型描述符
    expect(meta.columns[0].type).toBe('str')
    expect(meta.columns[1].type).toBe('sbyte')
  })

  it('SchemaManager 应能从 root.exl 获取全量 7,900+ 表名', async () => {
    const allSheets = await schemaManager.getAllSheetNames(cnReader)
    expect(allSheets.length).toBeGreaterThan(7000)
    for (const core of CORE_SHEET_NAMES) {
      expect(allSheets).toContain(core)
    }
  })

  it('CsvExportService 应导出带 UTF-8 BOM 且字符串列统一带双引号的 CSV', async () => {
    const chsCsv = await exporter.exportSheetToCsv('CraftType', 'chs')
    expect(chsCsv.startsWith('\ufeffkey,0,1')).toBe(true)

    const lines = chsCsv.split('\r\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(3)

    // 第一行为 key,0,1,2...
    expect(lines[0]).toContain('key,0,1')
    // 第二行包含字段名
    expect(lines[1]).toContain('Name')
    // 第三行包含 str 类型
    expect(lines[2]).toContain('str')

    // 数据行验证字符串带双引号（如 "木工"）
    const craftRow = lines.find((l) => l.includes('木工'))
    expect(craftRow).toBeDefined()
    expect(craftRow).toContain('"木工"')

    // 国际服英语验证
    const enCsv = await exporter.exportSheetToCsv('CraftType', 'en')
    expect(enCsv.startsWith('\ufeffkey,0,1')).toBe(true)
    expect(enCsv).toContain('"Woodworking"')
  })

  it('CsvExportService 应能打包生成包含各语言文件夹的 zip 流', async () => {
    const langs: SupportedExportLang[] = ['chs', 'ja', 'en']
    const stream = exporter.createExportZipStream(['CraftType'], langs)

    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (c) => chunks.push(Buffer.from(c)))
      stream.on('end', () => resolve())
      stream.on('error', reject)
    })

    const zipBuf = Buffer.concat(chunks)
    expect(zipBuf.length).toBeGreaterThan(100)
    expect(zipBuf[0]).toBe(0x50)
    expect(zipBuf[1]).toBe(0x4b)
  })

  it('本地解包应先扫描并清理目标目录已有语言文件夹，随后输出 CSV 文件', async () => {
    // 模拟目标目录下已存在旧的 chs 和 ja 目录与旧文件
    const oldChsDir = path.join(testOutputDir, 'chs')
    fs.mkdirSync(oldChsDir, { recursive: true })
    const staleFile = path.join(oldChsDir, 'stale_old_file.txt')
    fs.writeFileSync(staleFile, 'old data', 'utf8')
    expect(fs.existsSync(staleFile)).toBe(true)

    // 触发对指定目录的解包（指定若干张测试表以快速验证端到端清理与输出逻辑）
    await exporter.startUnpackToLocalDirectory(testOutputDir, ['chs', 'ja'], [
      'CraftType',
      'PlaceName',
    ])

    // 等待后台任务完成
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const st = exporter.getLocalUnpackStatus()
        if (st && !st.isRunning) {
          clearInterval(interval)
          resolve()
        }
      }, 500)
    })

    const status = exporter.getLocalUnpackStatus()
    expect(status?.isCompleted).toBe(true)

    // 验证旧文件已被清理删除
    expect(fs.existsSync(staleFile)).toBe(false)

    // 验证新解包出的文件正常写入，且包含子目录文件
    const newCraftFile = path.join(testOutputDir, 'chs/CraftType.csv')
    expect(fs.existsSync(newCraftFile)).toBe(true)
    const content = fs.readFileSync(newCraftFile, 'utf8')
    expect(content).toContain('"木工"')
  }, 120000)
})
