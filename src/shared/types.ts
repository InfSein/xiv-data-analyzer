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
    gilShopItems: number
    specialShopItems: number
    totalRecipes: number
    totalGatheringPoints: number
    totalFishingSpots: number
    totalShops: number
    totalAchievements: number
    totalTitles: number
    loadTimeMs: number
  }
  categories: ItemCategoryInfo[]
  craftTypes: CraftTypeInfo[]
  achievementKinds: AchievementKindInfo[]
}

export interface AchievementKindInfo {
  id: number
  name: string
  count: number
}

export interface AchievementEntry {
  id: number
  nameCn: string
  nameEn: string
  nameJa: string
  descriptionCn: string
  descriptionEn: string
  descriptionJa: string
  points: number
  iconId: number
  kindId: number
  kindName: string
  categoryId: number
  categoryName: string
  titleId: number
  titleMasculineCn: string
  titleFeminineCn: string
  titleNameEn: string
  titleNameJa: string
  titleIsPrefix: boolean
  rewardItemId: number
  rewardItemNameCn: string
  rewardItemIconId: number
}

export interface AchievementSearchQuery {
  q?: string
  kindId?: number
  filter?: 'all' | 'with_title' | 'with_item'
  page?: number
  pageSize?: number
}

export interface AchievementSearchResponse {
  items: AchievementEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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
  /** 可在玩家之间交易（未标记 IsUntradable） */
  isTradable: boolean
  /** 可在市场布告板上架出售（可交易且存在市场检索分类） */
  isMarketable: boolean
  isCraftable: boolean
  isGatherable: boolean
  isPurchasable: boolean
  /** 可在金币商店购买 */
  isGilShop: boolean
  /** 可在特殊兑换商店（特殊货币 / 军票 / 部队战绩）兑换 */
  isSpecialShop: boolean
  /** 拥有装备性能与副属性词条 */
  hasEquipmentStats: boolean
  usedInRecipesCount: number
}

export type ItemFilterMode =
  | 'all'
  | 'craftable'
  | 'gatherable'
  | 'purchasable'
  | 'gil_shop'
  | 'special_shop'
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

/**
 * 武器性能类型：物理武器只展示物理基本性能，魔法武器只展示魔法基本性能，盾牌展示格挡参数
 */
export type WeaponKind = 'physical' | 'magical' | 'shield' | 'none'

export interface EquipmentStats {
  weaponKind: WeaponKind
  damagePhys: number
  damagePhysHq: number
  damageMag: number
  damageMagHq: number
  /** 物理自动攻击（物理基本性能 × 攻击间隔 / 3） */
  autoAttack: number
  autoAttackHq: number
  delaySec: number
  blockRate: number
  blockRateHq: number
  block: number
  blockHq: number
  defensePhys: number
  defensePhysHq: number
  defenseMag: number
  defenseMagHq: number
  materiaSlotCount: number
  isAdvancedMeldingPermitted: boolean
  bonuses: EquipmentStatBonus[]
}

/**
 * 装备类道具的附加属性（对应游戏内道具说明底部的可/不可标记）
 */
export interface EquipmentAttributes {
  canExtractMateria: boolean
  isProjectable: boolean
  canDesynth: boolean
  desynthClassJobName: string
  dyeCount: number
  isCrestWorthy: boolean
  canStoreInGlamourDresser: boolean
  canStoreInArmoire: boolean
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
  /** 可出售给 NPC 商人 */
  isSellable: boolean
  /** 是否为可穿戴装备（存在装备槽位） */
  isEquipment: boolean
  classJobCategoryName: string
  equipSlotName: string
  repairClassJobName: string
  repairItemName: string
  equipmentStats?: EquipmentStats
  equipmentAttributes?: EquipmentAttributes
  consumableEffect?: ConsumableEffect
  recipes: RecipeDetail[]
  /** 与 recipes 一一对应的递归工序树 */
  recipeTrees: RecipeTreeNode[]
  usedInRecipes: UsedInRecipeItem[]
  gathering: GatheringMethodDetail
  shops: ShopPurchaseSource[]
  /** 奖励该道具的成就列表 */
  rewardedFromAchievements?: AchievementEntry[]
}

export interface VersionBackupMeta {
  version: string
  globalVersion: string
  createdAt: string
  itemCount: number
  recipeCount: number
  gatherableCount: number
  purchasableCount: number
  achievementCount?: number
  titleCount?: number
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

export type DiffEntityType = 'all' | 'item' | 'achievement'

export interface DiffItemEntry {
  id: number
  entityType?: 'item' | 'achievement'
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
  points?: number
  titleNameCn?: string
  rewardItemId?: number
  rewardItemNameCn?: string
  changes: ItemFieldChange[]
}

export interface VersionDiffQuery {
  from?: string
  to?: string
  filter?: DiffFilterType
  entityType?: DiffEntityType
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
    addedAchievements: number
    modifiedAchievements: number
    removedAchievements: number
    addedTitles: number
  }
  items: DiffItemEntry[]
  totalFiltered: number
  page: number
  pageSize: number
  totalPages: number
}
