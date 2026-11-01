/**
 * 前后端共享的数据结构与接口类型定义
 */

export interface ItemCategoryInfo {
  id: number
  name: string
  iconId: number
  count: number
}

export interface CraftTypeInfo {
  id: number
  name: string
  jobName: string
  iconId: number
  recipeCount: number
}

export interface SystemStatus {
  cnVersion: string
  globalVersion: string
  cnPath: string
  globalPath: string
  stats: {
    totalItems: number
    craftableItems: number
    gatherableItems: number
    purchasableItems: number
    totalRecipes: number
    totalGatheringPoints: number
    totalFishingSpots: number
    totalShops: number
    loadTimeMs: number
  }
  categories: ItemCategoryInfo[]
  craftTypes: CraftTypeInfo[]
}

export interface ItemSummary {
  id: number
  nameCn: string
  nameEn: string
  nameJa: string
  iconId: number
  itemLevel: number
  equipLevel: number
  rarity: number
  categoryId: number
  categoryName: string
  categoryIconId: number
  priceMid: number
  canBeHq: boolean
  isTradable: boolean
  isCraftable: boolean
  isGatherable: boolean
  isPurchasable: boolean
  usedInRecipesCount: number
}

export type ItemFilterMode =
  | 'all'
  | 'craftable'
  | 'gatherable'
  | 'purchasable'
  | 'ingredient'
  | 'equipment'
  | 'consumable'

export type ItemSortMode =
  | 'id_asc'
  | 'id_desc'
  | 'ilvl_desc'
  | 'ilvl_asc'
  | 'level_desc'

export interface ItemSearchQuery {
  q?: string
  categoryId?: number
  filter?: ItemFilterMode
  craftTypeId?: number
  minIlvl?: number
  maxIlvl?: number
  tradableOnly?: boolean
  sort?: ItemSortMode
  page?: number
  pageSize?: number
}

export interface ItemSearchResponse {
  items: ItemSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface EquipmentStatBonus {
  paramId: number
  name: string
  valueNq: number
  valueHq: number
}

export interface EquipmentStats {
  damagePhys: number
  damageMag: number
  delaySec: number
  blockRate: number
  block: number
  defensePhys: number
  defensePhysHq: number
  defenseMag: number
  defenseMagHq: number
  materiaSlotCount: number
  isAdvancedMeldingPermitted: boolean
  bonuses: EquipmentStatBonus[]
}

export interface ConsumableParamBonus {
  paramId: number
  name: string
  isRelative: boolean
  valueNq: number
  maxNq: number
  valueHq: number
  maxHq: number
}

export interface ConsumableEffect {
  typeName: string
  durationSec: number
  cooldownSec: number
  cooldownHqSec: number
  expBonusPercent: number
  params: ConsumableParamBonus[]
}

export interface RecipeIngredient {
  itemId: number
  nameCn: string
  nameEn: string
  iconId: number
  amount: number
  itemLevel: number
  isCraftable: boolean
  isGatherable: boolean
}

export interface RecipeDetail {
  id: number
  craftTypeId: number
  craftTypeName: string
  craftJobName: string
  craftJobIconId: number
  resultItemId: number
  resultAmount: number
  recipeLevel: number
  stars: number
  difficulty: number
  quality: number
  durability: number
  suggestedCraftsmanship: number
  requiredCraftsmanship: number
  requiredControl: number
  materialQualityFactor: number
  secretRecipeBookName: string
  isSpecializationRequired: boolean
  isExpert: boolean
  canQuickSynth: boolean
  canHq: boolean
  ingredients: RecipeIngredient[]
  crystals: RecipeIngredient[]
}

export interface RecipeTreeNode {
  itemId: number
  nameCn: string
  iconId: number
  amountPerCraft: number
  yieldPerCraft: number
  craftJobName?: string
  craftJobIconId?: number
  recipeLevel?: number
  stars?: number
  isGatherable: boolean
  children: RecipeTreeNode[]
  crystals: Array<{
    itemId: number
    nameCn: string
    iconId: number
    amount: number
  }>
}

export interface UsedInRecipeItem {
  recipeId: number
  resultItemId: number
  resultNameCn: string
  resultIconId: number
  resultItemLevel: number
  amountRequired: number
  craftJobName: string
  craftJobIconId: number
  recipeLevel: number
  stars: number
}

export interface GatheringTimeWindow {
  startEt: string // 如 "09:00"
  endEt: string // 如 "12:00"
  startMinuteOfDay: number // 0 ~ 1439
  durationMinutes: number
}

export interface GatheringNodeInfo {
  pointId: number
  baseId: number
  gatheringTypeId: number
  gatheringTypeName: string // 采掘 / 碎石 / 采伐 / 割草
  disciplineName: string // 采矿工 / 园艺工
  disciplineIconId: number
  gatheringTypeIconId: number
  nodeLevel: number
  itemLevel: number
  stars: number
  isHidden: boolean
  regionName: string
  zoneName: string
  placeName: string
  territoryId: number
  mapId: number
  mapPath: string // 如 "s1f1/00"
  sizeFactor: number
  coordX: number // 地图坐标 X，如 21.4
  coordY: number // 地图坐标 Y，如 15.8
  normX: number // 0~1 归一化横坐标
  normY: number // 0~1 归一化纵坐标
  radius: number
  folkloreBookName: string // 传承录要求
  isTimed: boolean
  isEphemeral: boolean
  timeWindows: GatheringTimeWindow[]
}

export interface FishingSpotInfo {
  spotId: number
  level: number
  categoryName: string
  regionName: string
  zoneName: string
  placeName: string
  territoryId: number
  mapId: number
  mapPath: string
  sizeFactor: number
  coordX: number
  coordY: number
  normX: number
  normY: number
  radius: number
  fishGuideText: string
  folkloreBookName: string
}

export interface SpearfishingInfo {
  notebookId: number
  level: number
  itemLevel: number
  regionName: string
  zoneName: string
  placeName: string
  territoryId: number
  mapId: number
  mapPath: string
  sizeFactor: number
  coordX: number
  coordY: number
  normX: number
  normY: number
  radius: number
  description: string
}

export interface GatheringMethodDetail {
  nodes: GatheringNodeInfo[]
  fishingSpots: FishingSpotInfo[]
  spearfishing: SpearfishingInfo[]
}

export interface ShopCostItem {
  itemId: number
  nameCn: string
  iconId: number
  amount: number
  collectability?: number
}

export interface ShopVendorNpc {
  npcId: number
  npcName: string
  npcTitle: string
  regionName: string
  zoneName: string
  placeName: string
  territoryId: number
  mapId: number
  mapPath: string
  sizeFactor: number
  coordX: number
  coordY: number
  normX: number
  normY: number
}

export interface ShopPurchaseSource {
  shopId: number
  shopType: 'gil' | 'special' | 'gc' | 'fcc'
  shopTypeLabel: string
  shopName: string
  receiveAmount: number
  receiveHq: boolean
  costs: ShopCostItem[]
  npcs: ShopVendorNpc[]
}

export interface ItemDetail extends ItemSummary {
  descriptionCn: string
  descriptionEn: string
  descriptionJa: string
  stackSize: number
  isUnique: boolean
  isIndisposable: boolean
  isCollectable: boolean
  dyeCount: number
  canDesynth: boolean
  canAetherialReduce: boolean
  isGlamourous: boolean
  priceLow: number
  classJobCategoryName: string
  equipSlotName: string
  repairClassJobName: string
  repairItemName: string
  equipmentStats?: EquipmentStats
  consumableEffect?: ConsumableEffect
  recipes: RecipeDetail[]
  recipeTree?: RecipeTreeNode
  usedInRecipes: UsedInRecipeItem[]
  gathering: GatheringMethodDetail
  shops: ShopPurchaseSource[]
}

export interface VersionBackupMeta {
  version: string
  globalVersion: string
  createdAt: string
  itemCount: number
  recipeCount: number
  gatherableCount: number
  purchasableCount: number
  isBaseline?: boolean
}

export interface VersionStatusResponse {
  currentVersion: string
  globalVersion: string
  previousVersion: string | null
  hasVersionUpdate: boolean
  lastBackupAt: string
  backups: VersionBackupMeta[]
}

export interface ItemFieldChange {
  field: string
  label: string
  before: string | number
  after: string | number
}

export type DiffFilterType = 'all' | 'added' | 'modified' | 'removed'

export interface DiffItemEntry {
  id: number
  changeType: 'added' | 'modified' | 'removed'
  nameCn: string
  nameEn: string
  iconId: number
  itemLevel: number
  equipLevel: number
  categoryName: string
  priceMid: number
  isCraftable: boolean
  isGatherable: boolean
  isPurchasable: boolean
  changes: ItemFieldChange[]
}

export interface VersionDiffQuery {
  from?: string
  to?: string
  filter?: DiffFilterType
  q?: string
  page?: number
  pageSize?: number
}

export interface VersionDiffResponse {
  fromVersion: string
  toVersion: string
  fromCreatedAt: string
  toCreatedAt: string
  summary: {
    addedItems: number
    modifiedItems: number
    removedItems: number
    addedRecipes: number
    newCraftableItems: number
    newGatherableItems: number
    newPurchasableItems: number
  }
  items: DiffItemEntry[]
  totalFiltered: number
  page: number
  pageSize: number
  totalPages: number
}
