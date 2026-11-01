import { GameSqPackReader, Language } from '@ffcafe/elpis-sqpack'
import type {
  CraftTypeInfo,
  ItemCategoryInfo,
  ItemSummary,
} from '../shared/types'
import {
  type GamePathsConfig,
  loadGamePathsFromEnv,
  verifyAndReadGameVersions,
} from './config'
import {
  type RawNpcLocation,
  type RawShopEntry,
  buildShopIndices,
} from './shop-loader'
import { decodeSeString, loadSheetRows, loadSubrowSheet } from './sqpack-helper'

const EQUIP_SLOT_NAMES = [
  '主手',
  '副手',
  '头部',
  '身体',
  '手部',
  '腰部',
  '腿部',
  '脚部',
  '耳饰',
  '颈部',
  '腕部',
  '戒指',
  '戒指',
  '灵魂水晶',
]

/**
 * 解析装备槽位分类行数据为中文部位说明
 */
function formatEquipSlotCategory(row: any[]): string {
  const slots: string[] = []
  for (let i = 0; i < Math.min(row.length, EQUIP_SLOT_NAMES.length); i++) {
    if (Number(row[i]) > 0) {
      const name = EQUIP_SLOT_NAMES[i]
      if (!slots.includes(name)) {
        slots.push(name)
      }
    }
  }
  return slots.join(' / ')
}

export interface LoadedGameStore {
  cnReader: GameSqPackReader
  globalReader: GameSqPackReader
  cnVersion: string
  globalVersion: string
  cnPath: string
  globalPath: string
  loadTimeMs: number

  // 核心原始表与字典映射
  itemsCn: Map<number, any[]>
  itemsEn: Map<number, any[]>
  itemsJa: Map<number, any[]>
  categories: Map<number, { name: string; iconId: number }>
  classJobs: Map<number, { name: string; abbr: string }>
  classJobCategories: Map<number, string>
  baseParams: Map<number, { name: string; description: string }>
  equipSlots: Map<number, string>
  itemRepairResources: Map<number, number>
  itemActions: Map<number, any[]>
  itemFoods: Map<number, any[]>

  // 配方表与反向索引
  recipes: Map<number, any[]>
  recipesByResultItem: Map<number, number[]>
  recipesByIngredientItem: Map<
    number,
    Array<{ recipeId: number; amount: number }>
  >
  recipeLevelTables: Map<number, any[]>
  craftTypes: Map<number, CraftTypeInfo>
  secretRecipeBooks: Map<number, { itemId: number; name: string }>

  // 采集与捕鱼表及反向索引
  gatheringItems: Map<number, any[]>
  gatheringItemsByItem: Map<number, number[]>
  gatheringPointsByGatheringItem: Map<number, number[]>
  gatheringPoints: Map<number, any[]>
  gatheringPointBases: Map<number, any[]>
  exportedGatheringPoints: Map<number, any[]>
  gatheringPointTransients: Map<number, any[]>
  gatheringRarePopTimeTables: Map<number, any[]>
  gatheringItemLevels: Map<number, { level: number; stars: number }>
  gatheringTypes: Map<number, { name: string; iconId: number }>
  gatheringSubCategories: Map<number, { itemId: number; name: string }>
  territoryTypes: Map<number, any[]>
  placeNames: Map<number, string>
  maps: Map<number, any[]>
  fishingSpots: Map<number, any[]>
  fishingSpotsByItem: Map<number, number[]>
  fishParametersByItem: Map<number, any[]>
  spearfishingByItem: Map<
    number,
    Array<{
      spearfishingItemRow: any[]
      notebookId: number
      notebookRow: any[]
    }>
  >

  // NPC 商店与坐标反向索引
  shopsByItem: Map<number, RawShopEntry[]>
  npcNames: Map<number, { name: string; title: string }>
  npcLocations: Map<number, RawNpcLocation>
  totalActiveShops: number

  // 预构建的道具摘要索引与统计分类
  itemSummaries: ItemSummary[]
  itemSummaryById: Map<number, ItemSummary>
  categoryList: ItemCategoryInfo[]
  craftTypeList: CraftTypeInfo[]
}

/**
 * 构建配方正反向索引（产物 -> 配方列表，原料 -> 配方列表）
 */
function buildRecipeIndices(recipes: Map<number, any[]>) {
  const recipesByResultItem = new Map<number, number[]>()
  const recipesByIngredientItem = new Map<
    number,
    Array<{ recipeId: number; amount: number }>
  >()
  const recipeCountByCraftType = new Map<number, number>()

  for (const [recipeId, row] of recipes.entries()) {
    const resultItemId = Number(row[4])
    if (resultItemId <= 0) continue

    const craftTypeId = Number(row[1])
    recipeCountByCraftType.set(
      craftTypeId,
      (recipeCountByCraftType.get(craftTypeId) || 0) + 1,
    )

    let list = recipesByResultItem.get(resultItemId)
    if (!list) {
      list = []
      recipesByResultItem.set(resultItemId, list)
    }
    list.push(recipeId)

    // 扫描 8 个原料/水晶槽位 (列 6..21)
    for (let i = 0; i < 8; i++) {
      const ingItemId = Number(row[6 + i * 2])
      const ingAmount = Number(row[7 + i * 2])
      if (ingItemId > 0 && ingAmount > 0) {
        let usedList = recipesByIngredientItem.get(ingItemId)
        if (!usedList) {
          usedList = []
          recipesByIngredientItem.set(ingItemId, usedList)
        }
        usedList.push({ recipeId, amount: ingAmount })
      }
    }
  }

  return {
    recipesByResultItem,
    recipesByIngredientItem,
    recipeCountByCraftType,
  }
}

/**
 * 构建采集与捕鱼反向索引（道具 -> 采集点 / 钓场 / 刺鱼点）
 */
function buildGatheringIndices(
  gatheringItems: Map<number, any[]>,
  gatheringItemPointSubrows: Map<number, Array<{ subRowId: number; data: any[] }>>,
  gatheringPoints: Map<number, any[]>,
  gatheringPointBases: Map<number, any[]>,
  fishingSpots: Map<number, any[]>,
  fishParameters: Map<number, any[]>,
  spearfishingItems: Map<number, any[]>,
  spearfishingNotebooks: Map<number, any[]>,
) {
  const gatheringItemsByItem = new Map<number, number[]>()
  for (const [gItemId, row] of gatheringItems.entries()) {
    const itemId = Number(row[0])
    if (itemId <= 0) continue
    let list = gatheringItemsByItem.get(itemId)
    if (!list) {
      list = []
      gatheringItemsByItem.set(itemId, list)
    }
    list.push(gItemId)
  }

  // 合并 GatheringItemPoint 子行映射与有效 GatheringPoint 关联
  const gatheringPointsByGatheringItem = new Map<number, number[]>()
  const addPointLink = (gItemId: number, pointId: number) => {
    if (gItemId <= 0 || pointId <= 0) return
    let pts = gatheringPointsByGatheringItem.get(gItemId)
    if (!pts) {
      pts = []
      gatheringPointsByGatheringItem.set(gItemId, pts)
    }
    if (!pts.includes(pointId)) {
      pts.push(pointId)
    }
  }

  for (const [gItemId, subrows] of gatheringItemPointSubrows.entries()) {
    for (const sub of subrows) {
      const pointId = Number(sub.data[0])
      addPointLink(gItemId, pointId)
    }
  }

  for (const [pointId, ptRow] of gatheringPoints.entries()) {
    const baseId = Number(ptRow[3])
    const territoryId = Number(ptRow[7])
    const placeNameId = Number(ptRow[8])
    if (baseId <= 0 || territoryId <= 1 || placeNameId <= 0) continue
    const baseRow = gatheringPointBases.get(baseId)
    if (!baseRow) continue
    for (let i = 2; i <= 9; i++) {
      const gItemId = Number(baseRow[i])
      if (gItemId > 0 && gItemId < 20000) {
        addPointLink(gItemId, pointId)
      }
    }
  }

  // 钓场反向索引 (列 13..22 为 10 个鱼类槽位)
  const fishingSpotsByItem = new Map<number, number[]>()
  for (const [spotId, row] of fishingSpots.entries()) {
    const territoryId = Number(row[6])
    if (territoryId <= 0) continue
    for (let i = 13; i <= 22; i++) {
      const fishItemId = Number(row[i])
      if (fishItemId > 0) {
        let spots = fishingSpotsByItem.get(fishItemId)
        if (!spots) {
          spots = []
          fishingSpotsByItem.set(fishItemId, spots)
        }
        if (!spots.includes(spotId)) {
          spots.push(spotId)
        }
      }
    }
  }

  const fishParametersByItem = new Map<number, any[]>()
  for (const [, row] of fishParameters.entries()) {
    const itemId = Number(row[4])
    if (itemId > 0 && !fishParametersByItem.has(itemId)) {
      fishParametersByItem.set(itemId, row)
    }
  }

  // 刺鱼反向索引：SpearfishingNotebook.GatheringPointBase (col 9) -> GatheringPointBase slots (col 2..9) -> SpearfishingItem rowId
  const notebooksByBaseId = new Map<
    number,
    Array<{ notebookId: number; notebookRow: any[] }>
  >()
  for (const [notebookId, nbRow] of spearfishingNotebooks.entries()) {
    const baseId = Number(nbRow[9])
    if (baseId <= 0) continue
    let list = notebooksByBaseId.get(baseId)
    if (!list) {
      list = []
      notebooksByBaseId.set(baseId, list)
    }
    list.push({ notebookId, notebookRow: nbRow })
  }

  const spearfishingByItem = new Map<
    number,
    Array<{
      spearfishingItemRow: any[]
      notebookId: number
      notebookRow: any[]
    }>
  >()

  for (const [baseId, nbs] of notebooksByBaseId.entries()) {
    const baseRow = gatheringPointBases.get(baseId)
    if (!baseRow) continue
    for (let i = 2; i <= 9; i++) {
      const sfItemId = Number(baseRow[i])
      if (sfItemId <= 0) continue
      const sfRow = spearfishingItems.get(sfItemId)
      if (!sfRow) continue
      const itemId = Number(sfRow[1])
      if (itemId <= 0) continue

      let entries = spearfishingByItem.get(itemId)
      if (!entries) {
        entries = []
        spearfishingByItem.set(itemId, entries)
      }
      for (const nb of nbs) {
        entries.push({
          spearfishingItemRow: sfRow,
          notebookId: nb.notebookId,
          notebookRow: nb.notebookRow,
        })
      }
    }
  }

  return {
    gatheringItemsByItem,
    gatheringPointsByGatheringItem,
    fishingSpotsByItem,
    fishParametersByItem,
    spearfishingByItem,
  }
}

/**
 * 加载本地国服与国际服 SqPack 数据并构建完整内存索引
 */
export async function loadGameDataStore(
  customConfig?: GamePathsConfig,
): Promise<LoadedGameStore> {
  const startTime = Date.now()
  const config = customConfig ?? loadGamePathsFromEnv()
  const { cnVersion, globalVersion } = await verifyAndReadGameVersions(config)

  const cnReader = new GameSqPackReader(config.cnGamePath)
  const globalReader = new GameSqPackReader(config.globalGamePath)

  // 并行加载所有需要的 Excel 数据表
  const [
    itemsCn,
    itemsEn,
    itemsJa,
    rawCategories,
    rawClassJobs,
    rawClassJobCategories,
    rawBaseParams,
    rawEquipSlots,
    rawRepairResources,
    itemActions,
    itemFoods,
    recipes,
    recipeLevelTables,
    rawCraftTypes,
    rawSecretBooks,
    gatheringItems,
    gatheringItemPointSubrows,
    gatheringPoints,
    gatheringPointBases,
    exportedGatheringPoints,
    gatheringPointTransients,
    gatheringRarePopTimeTables,
    rawGatheringItemLevels,
    rawGatheringTypes,
    rawGatheringSubCategories,
    territoryTypes,
    rawPlaceNames,
    maps,
    fishingSpots,
    fishParameters,
    spearfishingItems,
    spearfishingNotebooks,
    gilShops,
    gilShopItems,
    specialShops,
    gcScripShopItems,
    fccShops,
    tomestonesItems,
    enpcResidents,
    enpcBases,
    topicSelects,
    preHandlers,
    inclusionShops,
    inclusionCategories,
    inclusionSeries,
    customTalks,
    levels,
  ] = await Promise.all([
    loadSheetRows(cnReader, 'Item', Language.ChineseSimplified),
    loadSheetRows(globalReader, 'Item', Language.English, [8, 9]),
    loadSheetRows(globalReader, 'Item', Language.Japanese, [8, 9]),
    loadSheetRows(cnReader, 'ItemUICategory', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'ClassJob', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'ClassJobCategory', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'BaseParam', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'EquipSlotCategory', Language.None),
    loadSheetRows(cnReader, 'ItemRepairResource', Language.None),
    loadSheetRows(cnReader, 'ItemAction', Language.None),
    loadSheetRows(cnReader, 'ItemFood', Language.None),
    loadSheetRows(cnReader, 'Recipe', Language.None),
    loadSheetRows(cnReader, 'RecipeLevelTable', Language.None),
    loadSheetRows(cnReader, 'CraftType', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'SecretRecipeBook', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'GatheringItem', Language.None),
    loadSubrowSheet(cnReader, 'GatheringItemPoint', Language.None),
    loadSheetRows(cnReader, 'GatheringPoint', Language.None),
    loadSheetRows(cnReader, 'GatheringPointBase', Language.None),
    loadSheetRows(cnReader, 'ExportedGatheringPoint', Language.None),
    loadSheetRows(cnReader, 'GatheringPointTransient', Language.None),
    loadSheetRows(cnReader, 'GatheringRarePopTimeTable', Language.None),
    loadSheetRows(cnReader, 'GatheringItemLevelConvertTable', Language.None),
    loadSheetRows(cnReader, 'GatheringType', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'GatheringSubCategory', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'TerritoryType', Language.None),
    loadSheetRows(cnReader, 'PlaceName', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'Map', Language.None),
    loadSheetRows(cnReader, 'FishingSpot', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'FishParameter', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'SpearfishingItem', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'SpearfishingNotebook', Language.None),
    loadSheetRows(cnReader, 'GilShop', Language.ChineseSimplified),
    loadSubrowSheet(cnReader, 'GilShopItem', Language.None),
    loadSheetRows(cnReader, 'SpecialShop', Language.ChineseSimplified),
    loadSubrowSheet(cnReader, 'GCScripShopItem', Language.None),
    loadSheetRows(cnReader, 'FccShop', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'TomestonesItem', Language.None),
    loadSheetRows(cnReader, 'ENpcResident', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'ENpcBase', Language.None),
    loadSheetRows(cnReader, 'TopicSelect', Language.ChineseSimplified),
    loadSheetRows(cnReader, 'PreHandler', Language.None),
    loadSheetRows(cnReader, 'InclusionShop', Language.None),
    loadSheetRows(cnReader, 'InclusionShopCategory', Language.ChineseSimplified),
    loadSubrowSheet(cnReader, 'InclusionShopSeries', Language.None),
    loadSheetRows(cnReader, 'CustomTalk', Language.None),
    loadSheetRows(cnReader, 'Level', Language.None),
  ])

  const categories = new Map<number, { name: string; iconId: number }>()
  for (const [id, row] of rawCategories.entries()) {
    const name = decodeSeString(row[0])
    if (name) {
      categories.set(id, { name, iconId: Number(row[1]) })
    }
  }

  const classJobs = new Map<number, { name: string; abbr: string }>()
  for (const [id, row] of rawClassJobs.entries()) {
    const name = decodeSeString(row[0])
    const abbr = decodeSeString(row[1])
    if (name) {
      classJobs.set(id, { name, abbr })
    }
  }

  const classJobCategories = new Map<number, string>()
  for (const [id, row] of rawClassJobCategories.entries()) {
    const name = decodeSeString(row[0])
    if (name) {
      classJobCategories.set(id, name)
    }
  }

  const baseParams = new Map<number, { name: string; description: string }>()
  for (const [id, row] of rawBaseParams.entries()) {
    const name = decodeSeString(row[1])
    if (name) {
      baseParams.set(id, { name, description: decodeSeString(row[2]) })
    }
  }

  const equipSlots = new Map<number, string>()
  for (const [id, row] of rawEquipSlots.entries()) {
    equipSlots.set(id, formatEquipSlotCategory(row))
  }

  const itemRepairResources = new Map<number, number>()
  for (const [id, row] of rawRepairResources.entries()) {
    itemRepairResources.set(id, Number(row[0]))
  }

  const secretRecipeBooks = new Map<number, { itemId: number; name: string }>()
  for (const [id, row] of rawSecretBooks.entries()) {
    const name = decodeSeString(row[1])
    if (name) {
      secretRecipeBooks.set(id, { itemId: Number(row[0]), name })
    }
  }

  const gatheringItemLevels = new Map<number, { level: number; stars: number }>()
  for (const [id, row] of rawGatheringItemLevels.entries()) {
    gatheringItemLevels.set(id, {
      level: Number(row[0]),
      stars: Number(row[1]),
    })
  }

  const gatheringTypes = new Map<number, { name: string; iconId: number }>()
  for (const [id, row] of rawGatheringTypes.entries()) {
    gatheringTypes.set(id, {
      name: decodeSeString(row[0]),
      iconId: Number(row[1]),
    })
  }

  const gatheringSubCategories = new Map<
    number,
    { itemId: number; name: string }
  >()
  for (const [id, row] of rawGatheringSubCategories.entries()) {
    const name = decodeSeString(row[5])
    if (name) {
      gatheringSubCategories.set(id, { itemId: Number(row[4]), name })
    }
  }

  const placeNames = new Map<number, string>()
  for (const [id, row] of rawPlaceNames.entries()) {
    const name = decodeSeString(row[0])
    if (name) {
      placeNames.set(id, name)
    }
  }

  const {
    recipesByResultItem,
    recipesByIngredientItem,
    recipeCountByCraftType,
  } = buildRecipeIndices(recipes)

  const craftTypes = new Map<number, CraftTypeInfo>()
  const craftTypeList: CraftTypeInfo[] = []
  for (const [id, row] of rawCraftTypes.entries()) {
    const name = decodeSeString(row[2])
    if (!name) continue
    // CraftType 0..7 对应 ClassJob 8..15，图标 ID 为 62008..62015
    const jobName = classJobs.get(id + 8)?.name || name
    const info: CraftTypeInfo = {
      id,
      name,
      jobName,
      iconId: 62008 + id,
      recipeCount: recipeCountByCraftType.get(id) || 0,
    }
    craftTypes.set(id, info)
    craftTypeList.push(info)
  }

  const {
    gatheringItemsByItem,
    gatheringPointsByGatheringItem,
    fishingSpotsByItem,
    fishParametersByItem,
    spearfishingByItem,
  } = buildGatheringIndices(
    gatheringItems,
    gatheringItemPointSubrows,
    gatheringPoints,
    gatheringPointBases,
    fishingSpots,
    fishParameters,
    spearfishingItems,
    spearfishingNotebooks,
  )

  const {
    shopsByItem,
    npcNames,
    npcLocations,
    totalActiveShops,
  } = buildShopIndices({
    itemsCn,
    gilShops,
    gilShopItems,
    specialShops,
    gcScripShopItems,
    fccShops,
    tomestonesItems,
    enpcResidents,
    enpcBases,
    topicSelects,
    preHandlers,
    inclusionShops,
    inclusionCategories,
    inclusionSeries,
    customTalks,
    levels,
  })

  // 构建全量有效道具摘要列表与分类计数
  const itemSummaries: ItemSummary[] = []
  const itemSummaryById = new Map<number, ItemSummary>()
  const categoryCountMap = new Map<number, number>()

  for (const [itemId, row] of itemsCn.entries()) {
    if (itemId <= 0) continue
    const nameCn = decodeSeString(row[9])
    if (!nameCn) continue

    const enRow = itemsEn.get(itemId)
    const jaRow = itemsJa.get(itemId)
    const categoryId = Number(row[15])
    const catInfo = categories.get(categoryId)

    const gItemIds = gatheringItemsByItem.get(itemId) || []
    const hasGatheringNode = gItemIds.some(
      (gid) => (gatheringPointsByGatheringItem.get(gid)?.length || 0) > 0,
    )
    const isGatherable =
      hasGatheringNode ||
      (fishingSpotsByItem.get(itemId)?.length || 0) > 0 ||
      (spearfishingByItem.get(itemId)?.length || 0) > 0

    const summary: ItemSummary = {
      id: itemId,
      nameCn,
      nameEn: enRow ? decodeSeString(enRow[9]) : '',
      nameJa: jaRow ? decodeSeString(jaRow[9]) : '',
      iconId: Number(row[10]),
      itemLevel: Number(row[11]),
      equipLevel: Number(row[40]),
      rarity: Number(row[12]),
      categoryId,
      categoryName: catInfo?.name || '其他',
      categoryIconId: catInfo?.iconId || 0,
      priceMid: Number(row[25]),
      canBeHq: Boolean(row[27]),
      isTradable: !row[22],
      isCraftable: recipesByResultItem.has(itemId),
      isGatherable,
      isPurchasable: (shopsByItem.get(itemId)?.length || 0) > 0,
      usedInRecipesCount: recipesByIngredientItem.get(itemId)?.length || 0,
    }

    itemSummaries.push(summary)
    itemSummaryById.set(itemId, summary)
    if (categoryId > 0) {
      categoryCountMap.set(
        categoryId,
        (categoryCountMap.get(categoryId) || 0) + 1,
      )
    }
  }

  itemSummaries.sort((a, b) => a.id - b.id)

  const categoryList: ItemCategoryInfo[] = []
  for (const [id, info] of categories.entries()) {
    const count = categoryCountMap.get(id) || 0
    if (count > 0) {
      categoryList.push({ id, name: info.name, iconId: info.iconId, count })
    }
  }
  categoryList.sort((a, b) => a.id - b.id)

  const loadTimeMs = Date.now() - startTime

  return {
    cnReader,
    globalReader,
    cnVersion,
    globalVersion,
    cnPath: config.cnRootPath,
    globalPath: config.globalRootPath,
    loadTimeMs,
    itemsCn,
    itemsEn,
    itemsJa,
    categories,
    classJobs,
    classJobCategories,
    baseParams,
    equipSlots,
    itemRepairResources,
    itemActions,
    itemFoods,
    recipes,
    recipesByResultItem,
    recipesByIngredientItem,
    recipeLevelTables,
    craftTypes,
    secretRecipeBooks,
    gatheringItems,
    gatheringItemsByItem,
    gatheringPointsByGatheringItem,
    gatheringPoints,
    gatheringPointBases,
    exportedGatheringPoints,
    gatheringPointTransients,
    gatheringRarePopTimeTables,
    gatheringItemLevels,
    gatheringTypes,
    gatheringSubCategories,
    territoryTypes,
    placeNames,
    maps,
    fishingSpots,
    fishingSpotsByItem,
    fishParametersByItem,
    spearfishingByItem,
    shopsByItem,
    npcNames,
    npcLocations,
    totalActiveShops,
    itemSummaries,
    itemSummaryById,
    categoryList,
    craftTypeList,
  }
}
