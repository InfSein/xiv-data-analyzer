import fs from 'fs'
import path from 'path'
import { parse } from 'yaml'
import {
  type GameSqPackReader,
  readExhHeader,
  readExlFile,
} from '@ffcafe/elpis-sqpack'

/**
 * 列元数据（对应 SaintCoinach / ffxiv-datamining CSV 表头）
 */
export interface ColumnMeta {
  index: number
  name: string
  type: string
  offset: number
}

/**
 * 表结构元数据
 */
export interface SheetSchemaMeta {
  sheetName: string
  columns: ColumnMeta[]
  variant: number
}

/**
 * 格式化 EXH 二进制数据类型为 SaintCoinach 标准类型描述符
 */
export function formatColumnType(type: number): string {
  switch (type) {
    case 0:
      return 'str'
    case 1:
      return 'bool'
    case 2:
      return 'sbyte'
    case 3:
      return 'byte'
    case 4:
      return 'int16'
    case 5:
      return 'uint16'
    case 6:
      return 'int32'
    case 7:
      return 'uint32'
    case 9:
      return 'single'
    case 10:
      return 'int64'
    case 11:
      return 'uint64'
    case 25:
      return 'bit&01'
    case 26:
      return 'bit&02'
    case 27:
      return 'bit&04'
    case 28:
      return 'bit&08'
    case 29:
      return 'bit&10'
    case 30:
      return 'bit&20'
    case 31:
      return 'bit&40'
    case 32:
      return 'bit&80'
    default:
      return 'unk'
  }
}

/**
 * 核心推荐数据表清单（供快速导出与常用分析）
 */
export const CORE_SHEET_NAMES = [
  'Item',
  'Recipe',
  'Action',
  'Quest',
  'PlaceName',
  'ClassJob',
  'ClassJobCategory',
  'Status',
  'ENpcResident',
  'ENpcBase',
  'GatheringItem',
  'GatheringPoint',
  'FishingSpot',
  'GilShop',
  'SpecialShop',
  'Map',
  'TerritoryType',
]

export class SchemaManager {
  private readonly schemasDir: string
  private readonly schemaCache = new Map<string, SheetSchemaMeta>()
  private allSheetNamesCache: string[] | null = null

  constructor(schemasDir?: string) {
    this.schemasDir =
      schemasDir || path.resolve(process.cwd(), 'schemas')
  }

  /**
   * 从客户端的 root.exl 读取全量游戏表名称列表（包含所有 7,900+ 表）
   */
  async getAllSheetNames(reader: GameSqPackReader): Promise<string[]> {
    if (this.allSheetNamesCache) {
      return this.allSheetNamesCache
    }
    const exlBuf = await reader.readFile('exd/root.exl')
    if (!exlBuf) {
      return CORE_SHEET_NAMES
    }
    try {
      const exl = readExlFile(exlBuf)
      const names = exl.entries
        .map((e) => e.name)
        .filter(Boolean)
      this.allSheetNamesCache = names
      return names
    } catch (err) {
      console.warn('[SchemaManager] 解析 root.exl 失败，回退到默认列表:', err)
      return CORE_SHEET_NAMES
    }
  }

  /**
   * 检查指定表是否存在对应的 YAML schema 文件
   */
  hasSchemaFile(sheetName: string): boolean {
    const yamlPath = path.join(this.schemasDir, `${sheetName}.yml`)
    return fs.existsSync(yamlPath)
  }

  /**
   * 获取并解析指定表的完整列结构与表头定义
   */
  async getSheetSchema(
    reader: GameSqPackReader,
    sheetName: string,
  ): Promise<SheetSchemaMeta> {
    const cached = this.schemaCache.get(sheetName)
    if (cached) return cached

    const lowerName = sheetName.toLowerCase()
    const exhBuf = await reader.readFile(`exd/${lowerName}.exh`)
    if (!exhBuf) {
      throw new Error(`找不到数据表头文件: exd/${lowerName}.exh`)
    }
    const exh = readExhHeader(exhBuf)

    // 尝试读取 schemas/{sheetName}.yml
    const flatFieldNames = this.loadAndFlattenSchema(sheetName)

    // 将 EXH 列按 offset 升序排序；offset 相同的按类型/bit 排序
    const sortedCols = exh.columns.map((col, originalIndex) => ({
      originalIndex,
      offset: col.offset,
      type: col.type,
    }))

    sortedCols.sort((a, b) => {
      if (a.offset !== b.offset) return a.offset - b.offset
      if (a.type !== b.type) return a.type - b.type
      return a.originalIndex - b.originalIndex
    })

    // 根据 offset 排序后的顺序，将 schema 中对应的字段名赋予每一列
    const colNameByIndex = new Map<number, string>()
    for (let i = 0; i < sortedCols.length; i++) {
      const fieldName = i < flatFieldNames.length ? flatFieldNames[i] : ''
      colNameByIndex.set(sortedCols[i].originalIndex, fieldName)
    }

    // 按原始列索引组装 ColumnMeta
    const columns: ColumnMeta[] = exh.columns.map((col, index) => {
      const name = colNameByIndex.get(index) || ''
      const typeStr = formatColumnType(col.type)
      return {
        index,
        name,
        type: typeStr,
        offset: col.offset,
      }
    })

    const result: SheetSchemaMeta = {
      sheetName,
      columns,
      variant: exh.variant,
    }

    this.schemaCache.set(sheetName, result)
    return result
  }

  /**
   * 读取并展开 YAML 中的 fields 结构
   */
  private loadAndFlattenSchema(sheetName: string): string[] {
    const yamlPath = path.join(this.schemasDir, `${sheetName}.yml`)
    if (!fs.existsSync(yamlPath)) {
      return []
    }
    try {
      const content = fs.readFileSync(yamlPath, 'utf8')
      const doc = parse(content)
      if (!doc || !Array.isArray(doc.fields)) {
        return []
      }
      const flattened: string[] = []
      this.flattenNodeList(doc.fields, flattened, '')
      return flattened
    } catch (err) {
      console.warn(`[SchemaManager] 解析 ${sheetName}.yml 失败:`, err)
      return []
    }
  }

  /**
   * 递归展开 fields 列表
   */
  private flattenNodeList(list: any[], result: string[], prefix: string): void {
    for (const item of list) {
      if (!item) continue
      const count = typeof item.count === 'number' && item.count > 0 ? item.count : 1
      const baseName = typeof item.name === 'string' ? item.name : ''
      const fullName = prefix
        ? baseName
          ? `${prefix}.${baseName}`
          : prefix
        : baseName

      if (Array.isArray(item.fields) && item.fields.length > 0) {
        for (let c = 0; c < count; c++) {
          const itemPrefix = count > 1 ? `${fullName}[${c}]` : fullName
          this.flattenNodeList(item.fields, result, itemPrefix)
        }
      } else {
        for (let c = 0; c < count; c++) {
          const itemSuffix = count > 1 ? `[${c}]` : ''
          result.push(`${fullName}${itemSuffix}`)
        }
      }
    }
  }
}
