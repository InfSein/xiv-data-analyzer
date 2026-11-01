import { formatSeString, parseSeString } from '@ffcafe/elpis-sestring'
import {
  EXDReader,
  type ExhHeader,
  type GameSqPackReader,
  type IExdDataSubRow,
  Language,
  formatLanguage,
  readExhHeader,
} from '@ffcafe/elpis-sqpack'
import { formatTex } from '@ffcafe/elpis-texture'

/**
 * 将 SqPack EXD 中读取的 Buffer 字段解码为可读字符串
 * 若包含 SeString 控制标签（0x02 起始字节），则通过 @ffcafe/elpis-sestring 格式化为纯文本
 */
export function decodeSeString(val: unknown): string {
  if (!Buffer.isBuffer(val) || val.length === 0) {
    return typeof val === 'string' ? val : ''
  }
  // 快速路径：若不包含 SeString 标签起始符 0x02，则直接按 UTF-8 解码
  if (!val.includes(0x02)) {
    return val.toString('utf8').trim()
  }
  try {
    return formatSeString(parseSeString(val), {
      renderToText: true,
      lineBreak: '\n',
    }).trim()
  } catch {
    return val.toString('utf8').trim()
  }
}

/**
 * 根据 ExhHeader 选择最匹配的目标语言后缀
 */
function resolveLanguageSuffix(
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
 * 读取指定普通表（Variant = 1）的全部行数据
 * 支持按需指定 columnIndexes 以减少内存占用和加速跨语言读取
 */
export async function loadSheetRows(
  reader: GameSqPackReader,
  sheetName: string,
  preferredLang: Language = Language.ChineseSimplified,
  columnIndexes?: readonly number[],
): Promise<Map<number, any[]>> {
  const lowerName = sheetName.toLowerCase()
  const exhBuf = await reader.readFile(`exd/${lowerName}.exh`)
  if (!exhBuf) {
    throw new Error(`未找到数据表头文件: exd/${lowerName}.exh`)
  }
  const exh = readExhHeader(exhBuf)
  const langSuffix = resolveLanguageSuffix(exh, preferredLang)
  const rows = new Map<number, any[]>()

  await Promise.all(
    exh.paginations.map(async (page) => {
      const exdPath = `exd/${lowerName}_${page.startId}${langSuffix}.exd`
      const exdBuf = await reader.readFile(exdPath)
      if (!exdBuf) return
      const exd = new EXDReader(exdBuf, exh)
      for (const rowId of exd.listRowIds()) {
        rows.set(rowId, exd.readRow(rowId, columnIndexes))
      }
    }),
  )

  return rows
}

/**
 * 读取指定子行表（Variant = 2，如 GatheringItemPoint）的全部数据
 */
export async function loadSubrowSheet(
  reader: GameSqPackReader,
  sheetName: string,
  preferredLang: Language = Language.None,
): Promise<Map<number, IExdDataSubRow[]>> {
  const lowerName = sheetName.toLowerCase()
  const exhBuf = await reader.readFile(`exd/${lowerName}.exh`)
  if (!exhBuf) {
    throw new Error(`未找到子行表头文件: exd/${lowerName}.exh`)
  }
  const exh = readExhHeader(exhBuf)
  const langSuffix = resolveLanguageSuffix(exh, preferredLang)
  const rows = new Map<number, IExdDataSubRow[]>()

  await Promise.all(
    exh.paginations.map(async (page) => {
      const exdPath = `exd/${lowerName}_${page.startId}${langSuffix}.exd`
      const exdBuf = await reader.readFile(exdPath)
      if (!exdBuf) return
      const exd = new EXDReader(exdBuf, exh)
      for (const rowId of exd.listRowIds()) {
        const count = exd.getSubRowCount(rowId)
        const subrows: IExdDataSubRow[] = []
        for (let i = 0; i < count; i++) {
          subrows.push(exd.readSubrow(rowId, i))
        }
        rows.set(rowId, subrows)
      }
    }),
  )

  return rows
}

/**
 * 内存 PNG 贴图缓存（限制最大条目数防止内存无限增长）
 */
const texturePngCache = new Map<string, Buffer>()
const MAX_TEXTURE_CACHE = 800

function setTextureCache(key: string, data: Buffer): void {
  if (texturePngCache.size >= MAX_TEXTURE_CACHE) {
    const firstKey = texturePngCache.keys().next().value
    if (firstKey !== undefined) {
      texturePngCache.delete(firstKey)
    }
  }
  texturePngCache.set(key, data)
}

/**
 * 根据图标 ID 从本地 SqPack 中读取 .tex 并通过 @ffcafe/elpis-texture 解码为 PNG
 * 优先尝试高清 (_hr1) 贴图，若请求 HQ 图标则优先读取 hq/ 子目录
 */
export async function readIconPng(
  reader: GameSqPackReader,
  iconId: number,
  isHq = false,
): Promise<Buffer | null> {
  if (!Number.isInteger(iconId) || iconId <= 0) return null
  const cacheKey = `icon:${iconId}:${isHq ? 'hq' : 'nq'}`
  const cached = texturePngCache.get(cacheKey)
  if (cached) return cached

  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0')
  const file = String(iconId).padStart(6, '0')

  const candidates = isHq
    ? [
        `ui/icon/${folder}/hq/${file}_hr1.tex`,
        `ui/icon/${folder}/hq/${file}.tex`,
        `ui/icon/${folder}/${file}_hr1.tex`,
        `ui/icon/${folder}/${file}.tex`,
      ]
    : [`ui/icon/${folder}/${file}_hr1.tex`, `ui/icon/${folder}/${file}.tex`]

  for (const texPath of candidates) {
    const texBuf = await reader.readFile(texPath)
    if (texBuf) {
      const png = await formatTex(texBuf)
      setTextureCache(cacheKey, png.data)
      return png.data
    }
  }
  return null
}

/**
 * 根据地图路径标识（如 "s1f1/00"）从本地 SqPack 读取地图贴图并解码为 PNG
 */
export async function readMapPng(
  reader: GameSqPackReader,
  mapPath: string,
): Promise<Buffer | null> {
  const clean = mapPath.trim().toLowerCase()
  if (!/^[a-z0-9_]+\/\d{2}$/.test(clean)) return null

  const cacheKey = `map:${clean}`
  const cached = texturePngCache.get(cacheKey)
  if (cached) return cached

  const flatName = clean.replace('/', '')
  const candidates = [
    `ui/map/${clean}/${flatName}_m.tex`,
    `ui/map/${clean}/${flatName}_s.tex`,
  ]

  for (const texPath of candidates) {
    const texBuf = await reader.readFile(texPath)
    if (texBuf) {
      const png = await formatTex(texBuf)
      setTextureCache(cacheKey, png.data)
      return png.data
    }
  }
  return null
}
