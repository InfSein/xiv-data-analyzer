import type {
  AchievementSearchQuery,
  AchievementSearchResponse,
  ConsumableEffect,
  ConsumableParamBonus,
  EquipmentAttributes,
  EquipmentStatBonus,
  EquipmentStats,
  FishingSpotInfo,
  GatheringMethodDetail,
  GatheringNodeInfo,
  GatheringTimeWindow,
  ItemDetail,
  ItemSearchQuery,
  ItemSearchResponse,
  RecipeDetail,
  RecipeIngredient,
  RecipeTreeNode,
  ShopCostItem,
  ShopPurchaseSource,
  ShopVendorNpc,
  SpearfishingInfo,
  SystemStatus,
  UsedInRecipeItem,
  WeaponKind,
} from '../shared/types'
import type { LoadedGameStore } from './data-loader'
import { decodeSeString, readIconPng, readMapPng } from './sqpack-helper'

const FISHING_SPOT_CATEGORIES: Record<number, string> = {
  1: '海洋垂钓',
  2: '淡水垂钓',
  3: '沙海垂钓',
  4: '云海垂钓',
  5: '魔晶垂钓',
  6: '盐湖垂钓',
  7: '星海垂钓',
}

/**
 * 将表中的 HHMM 整数（如 900 代表 09:00，300 代表 3小时0分）转换为总分钟数
 */
function hhmmToMinutes(hhmm: number): number {
  const hours = Math.floor(hhmm / 100)
  const minutes = hhmm % 100
  return hours * 60 + minutes
}

/**
 * 将总分钟数（0 ~ 1439）格式化为 "HH:MM"
 */
function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 将世界 3D 坐标转换为 2D 地图坐标与归一化位置
 */
function convertWorldCoordToMap(
  worldX: number,
  worldY: number,
  sizeFactor: number,
  offsetX: number,
  offsetY: number,
) {
  const scale = (sizeFactor || 100) / 100
  const rawNormX = ((worldX + offsetX) * scale + 1024) / 2048
  const rawNormY = ((worldY + offsetY) * scale + 1024) / 2048
  const normX = Math.max(0, Math.min(1, rawNormX))
  const normY = Math.max(0, Math.min(1, rawNormY))
  const coordX = Number(((41 / scale) * normX + 1).toFixed(1))
  const coordY = Number(((41 / scale) * normY + 1).toFixed(1))
  return { coordX, coordY, normX, normY }
}

/**
 * 将 2048x2048 像素坐标转换为 2D 地图坐标与归一化位置
 */
function convertPixelCoordToMap(
  pixelX: number,
  pixelY: number,
  sizeFactor: number,
) {
  const scale = (sizeFactor || 100) / 100
  const normX = Math.max(0, Math.min(1, pixelX / 2048))
  const normY = Math.max(0, Math.min(1, pixelY / 2048))
  const coordX = Number(((41 / scale) * normX + 1).toFixed(1))
  const coordY = Number(((41 / scale) * normY + 1).toFixed(1))
  return { coordX, coordY, normX, normY }
}

export class GameDataService {
  constructor(private readonly store: LoadedGameStore) {}

  /**
   * 获取底层内存数据仓库实例
   */
  getStore(): LoadedGameStore {
    return this.store
  }

  /**
   * 获取系统概览与统计状态
   */
  getSystemStatus(): SystemStatus {
    let craftableItems = 0
    let gatherableItems = 0
    let purchasableItems = 0
    let gilShopItems = 0
    let specialShopItems = 0
    for (const item of this.store.itemSummaries) {
      if (item.isCraftable) craftableItems++
      if (item.isGatherable) gatherableItems++
      if (item.isPurchasable) purchasableItems++
      if (item.isGilShop) gilShopItems++
      if (item.isSpecialShop) specialShopItems++
    }

    return {
      cnVersion: this.store.cnVersion,
      globalVersion: this.store.globalVersion,
      cnPath: this.store.cnPath,
      globalPath: this.store.globalPath,
      stats: {
        totalItems: this.store.itemSummaries.length,
        craftableItems,
        gatherableItems,
        purchasableItems,
        gilShopItems,
        specialShopItems,
        totalRecipes: this.store.recipes.size,
        totalGatheringPoints: this.store.gatheringPoints.size,
        totalFishingSpots: this.store.fishingSpots.size,
        totalShops: this.store.totalActiveShops,
        totalAchievements: this.store.achievements.length,
        totalTitles: this.store.totalTitles,
        loadTimeMs: this.store.loadTimeMs,
      },
      categories: this.store.categoryList,
      craftTypes: this.store.craftTypeList,
      achievementKinds: this.store.achievementKindList,
    }
  }

  /**
   * 搜索与多条件筛选道具列表
   */
  searchItems(query: ItemSearchQuery): ItemSearchResponse {
    const q = (query.q || '').trim().toLowerCase()
    const numericQuery = /^\d+$/.test(q) ? Number(q) : null
    const categoryId = query.categoryId ? Number(query.categoryId) : 0
    const filter = query.filter || 'all'
    const craftTypeId =
      query.craftTypeId !== undefined && query.craftTypeId >= 0
        ? Number(query.craftTypeId)
        : undefined
    const minIlvl = query.minIlvl ? Number(query.minIlvl) : 0
    const maxIlvl = query.maxIlvl ? Number(query.maxIlvl) : 0
    const tradableOnly = Boolean(query.tradableOnly)

    let filtered = this.store.itemSummaries.filter((item) => {
      if (categoryId > 0 && item.categoryId !== categoryId) return false
      if (minIlvl > 0 && item.itemLevel < minIlvl) return false
      if (maxIlvl > 0 && item.itemLevel > maxIlvl) return false
      if (tradableOnly && !item.isTradable) return false

      if (filter === 'craftable' && !item.isCraftable) return false
      if (filter === 'gatherable' && !item.isGatherable) return false
      if (filter === 'purchasable' && !item.isPurchasable) return false
      if (filter === 'gil_shop' && !item.isGilShop) return false
      if (filter === 'special_shop' && !item.isSpecialShop) return false
      if (filter === 'equipment' && !item.hasEquipmentStats) return false
      if (
        filter === 'consumable' &&
        item.categoryId !== 44 &&
        item.categoryId !== 46
      ) {
        return false
      }

      if (craftTypeId !== undefined) {
        const rIds = this.store.recipesByResultItem.get(item.id)
        if (!rIds) return false
        const matchesCraft = rIds.some(
          (rid) => Number(this.store.recipes.get(rid)?.[1]) === craftTypeId,
        )
        if (!matchesCraft) return false
      }

      if (q) {
        if (numericQuery !== null && item.id === numericQuery) return true
        return (
          item.nameCn.toLowerCase().includes(q) ||
          item.nameEn.toLowerCase().includes(q) ||
          item.nameJa.toLowerCase().includes(q) ||
          String(item.id) === q
        )
      }
      return true
    })

    // 若用户输入精确匹配的关键词，将完全匹配项排在最前
    const sortMode = query.sort || (q ? 'ilvl_desc' : 'id_asc')
    filtered = [...filtered].sort((a, b) => {
      if (q) {
        const aExact =
          a.id === numericQuery ||
          a.nameCn.toLowerCase() === q ||
          a.nameEn.toLowerCase() === q ||
          a.nameJa.toLowerCase() === q
        const bExact =
          b.id === numericQuery ||
          b.nameCn.toLowerCase() === q ||
          b.nameEn.toLowerCase() === q ||
          b.nameJa.toLowerCase() === q
        if (aExact !== bExact) return aExact ? -1 : 1
      }

      switch (sortMode) {
        case 'id_desc':
          return b.id - a.id
        case 'ilvl_desc':
          return b.itemLevel - a.itemLevel || a.id - b.id
        case 'ilvl_asc':
          return a.itemLevel - b.itemLevel || a.id - b.id
        case 'level_desc':
          return b.equipLevel - a.equipLevel || b.itemLevel - a.itemLevel
        case 'id_asc':
        default:
          return a.id - b.id
      }
    })

    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 30))
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.max(1, Math.min(totalPages, Number(query.page) || 1))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * 获取单个道具的完整详情（含属性、食品药水效果、配方、原料树、用途、采集与捕鱼点）
   */
  getItemDetail(itemId: number): ItemDetail | null {
    const summary = this.store.itemSummaryById.get(itemId)
    const row = this.store.itemsCn.get(itemId)
    if (!summary || !row) return null

    const enRow = this.store.itemsEn.get(itemId)
    const jaRow = this.store.itemsJa.get(itemId)

    const equipSlotId = Number(row[17])
    const isEquipment = equipSlotId > 0
    const classJobCategoryId = Number(row[43])
    const repairClassJobId = Number(row[33])
    const itemRepairId = Number(row[34])
    const repairResourceItemId =
      itemRepairId > 0
        ? this.store.itemRepairResources.get(itemRepairId) || 0
        : 0

    const repairClassJobName =
      this.store.classJobs.get(repairClassJobId)?.name || ''
    const equipmentStats = this.extractEquipmentStats(row)
    const equipmentAttributes = isEquipment
      ? this.extractEquipmentAttributes(itemId, row, repairClassJobName)
      : undefined
    const consumableEffect = this.extractConsumableEffect(row)
    const recipes = this.buildItemRecipes(itemId)
    const recipeTrees = recipes
      .map((r) => this.buildRecipeTreeForRecipe(r, r.resultAmount, 0, new Set()))
      .filter((t): t is RecipeTreeNode => Boolean(t))
    const usedInRecipes = this.buildUsedInRecipes(itemId)
    const gathering = this.buildGatheringDetail(itemId)
    const shops = this.buildShopSources(itemId)
    const rewardedFromAchievements =
      this.store.achievementsByRewardItem.get(itemId) || undefined

    const isIndisposable = Boolean(row[23])
    const priceLow = Number(row[26])
    const isSellable = !isIndisposable && priceLow > 0

    return {
      ...summary,
      descriptionCn: decodeSeString(row[8]),
      descriptionEn: enRow ? decodeSeString(enRow[8]) : '',
      descriptionJa: jaRow ? decodeSeString(jaRow[8]) : '',
      stackSize: Number(row[20]),
      isUnique: Boolean(row[21]),
      isIndisposable,
      isCollectable: Boolean(row[37]) || Boolean(row[38]),
      dyeCount: Number(row[28]),
      canDesynth: Number(row[36]) > 0,
      canAetherialReduce: Number(row[39]) > 0,
      isGlamourous: Boolean(row[90]),
      priceLow,
      isSellable,
      isEquipment,
      classJobCategoryName:
        this.store.classJobCategories.get(classJobCategoryId) || '',
      equipSlotName: this.store.equipSlots.get(equipSlotId) || '',
      repairClassJobName: isEquipment ? repairClassJobName : '',
      repairItemName: isEquipment
        ? this.store.itemSummaryById.get(repairResourceItemId)?.nameCn || ''
        : '',
      equipmentStats,
      equipmentAttributes,
      consumableEffect,
      recipes,
      recipeTrees,
      usedInRecipes,
      gathering,
      shops,
      rewardedFromAchievements,
    }
  }

  /**
   * 提取装备类物品的附加特性（精制魔晶石、武具投影、道具分解、染色、部队徽记、投影台、收藏柜）
   */
  private extractEquipmentAttributes(
    itemId: number,
    row: any[],
    repairClassJobName: string,
  ): EquipmentAttributes {
    const canExtractMateria = Number(row[85]) > 0
    const isProjectable = Boolean(row[90])
    const canDesynth = Number(row[36]) > 0
    const dyeCount = Number(row[28])
    const isCrestWorthy = Boolean(row[29])
    const canStoreInGlamourDresser = Boolean(row[90])
    const canStoreInArmoire = this.store.cabinetItemIds.has(itemId)

    return {
      canExtractMateria,
      isProjectable,
      canDesynth,
      desynthClassJobName: canDesynth ? repairClassJobName : '',
      dyeCount,
      isCrestWorthy,
      canStoreInGlamourDresser,
      canStoreInArmoire,
    }
  }

  /**
   * 提取装备武器性能、物理自动攻击、格挡、防御力及副属性加成（含 HQ 增益计算）
   */
  private extractEquipmentStats(row: any[]): EquipmentStats | undefined {
    const filterGroup = Number(row[13])
    const rawDamagePhys = Number(row[51])
    const rawDamageMag = Number(row[52])
    const delayMs = Number(row[53])
    const blockRate = Number(row[55])
    const block = Number(row[56])
    const defensePhys = Number(row[57])
    const defenseMag = Number(row[58])
    const materiaSlotCount = Number(row[86])
    const isAdvancedMeldingPermitted = Boolean(row[87])

    // 区分武器性能类型：FilterGroup 1 为物理武器（含主工具），2 为魔法武器，3 为盾牌
    let weaponKind: WeaponKind = 'none'
    if (filterGroup === 1) {
      weaponKind = 'physical'
    } else if (filterGroup === 2) {
      weaponKind = 'magical'
    } else if (filterGroup === 3 || blockRate > 0 || block > 0) {
      weaponKind = 'shield'
    } else if (rawDamagePhys > 0 && rawDamageMag === 0) {
      weaponKind = 'physical'
    } else if (rawDamageMag > 0 && rawDamagePhys === 0) {
      weaponKind = 'magical'
    } else if (rawDamagePhys > 0) {
      weaponKind = 'physical'
    }

    // 物理武器仅展示物理基本性能，魔法武器仅展示魔法基本性能
    const damagePhys = weaponKind === 'magical' ? 0 : rawDamagePhys
    const damageMag = weaponKind === 'physical' ? 0 : rawDamageMag

    // 收集 HQ / 特殊属性加成 (列 73..84 共 6 组)
    // ItemSpecialBonus === 1 时代表 HQ 品质加成，其他值（如 2 套装加成、7 神兵可定制属性）不计入 HQ 面板
    const itemSpecialBonus = Number(row[71])
    const specialBonusByParam = new Map<number, number>()
    for (let i = 0; i < 6; i++) {
      const paramId = Number(row[73 + i * 2])
      const bonusVal = Number(row[74 + i * 2])
      if (paramId > 0 && bonusVal !== 0) {
        specialBonusByParam.set(
          paramId,
          (specialBonusByParam.get(paramId) || 0) + bonusVal,
        )
      }
    }

    const hqExtraFor = (paramId: number): number =>
      itemSpecialBonus === 1 ? specialBonusByParam.get(paramId) || 0 : 0

    // 收集副属性加成 (列 59..70 共 6 组)
    const bonuses: EquipmentStatBonus[] = []
    for (let i = 0; i < 6; i++) {
      const paramId = Number(row[59 + i * 2])
      const valNq = Number(row[60 + i * 2])
      if (paramId > 0 && valNq !== 0) {
        const name =
          this.store.baseParams.get(paramId)?.name || `属性#${paramId}`
        const extraHq = hqExtraFor(paramId)
        bonuses.push({
          paramId,
          name,
          valueNq: valNq,
          valueHq: valNq + extraHq,
        })
      }
    }

    // 若存在仅在 HQ 生效的额外副属性（非 12物理基本性能 / 13魔法基本性能 / 17格挡发动力 / 18格挡性能 / 21物理防御力 / 24魔法防御力）
    if (itemSpecialBonus === 1) {
      const primaryParamIds = new Set([12, 13, 17, 18, 21, 24])
      const existingParamIds = new Set(bonuses.map((b) => b.paramId))
      for (const [paramId, bonusVal] of specialBonusByParam.entries()) {
        if (!primaryParamIds.has(paramId) && !existingParamIds.has(paramId) && bonusVal > 0) {
          const name =
            this.store.baseParams.get(paramId)?.name || `属性#${paramId}`
          bonuses.push({
            paramId,
            name,
            valueNq: 0,
            valueHq: bonusVal,
          })
        }
      }
    }

    // 物理基本性能=12，魔法基本性能=13，格挡发动力=17，格挡性能=18，物理防御力=21，魔法防御力=24
    const damagePhysHq =
      damagePhys > 0 ? damagePhys + hqExtraFor(12) : 0
    const damageMagHq =
      damageMag > 0 ? damageMag + hqExtraFor(13) : 0
    const blockRateHq =
      blockRate > 0 ? blockRate + hqExtraFor(17) : 0
    const blockHq = block > 0 ? block + hqExtraFor(18) : 0
    const defensePhysHq =
      defensePhys > 0 ? defensePhys + hqExtraFor(21) : 0
    const defenseMagHq =
      defenseMag > 0 ? defenseMag + hqExtraFor(24) : 0

    // 计算武器物理自动攻击：trunc((DamagePhys * DelayMs) / 3000 * 100) / 100
    // 在 FF14 游戏内，不论是物理武器还是魔法武器，均按底层 DamagePhys (row[51]) 与攻击间隔计算物理自动攻击
    const calcAutoAttack = (physDmg: number): number => {
      if (physDmg <= 0 || delayMs <= 0) return 0
      return Math.floor(((physDmg * delayMs) / 3000) * 100) / 100
    }
    const rawDamagePhysHq =
      rawDamagePhys > 0 ? rawDamagePhys + hqExtraFor(12) : 0
    const autoAttack = calcAutoAttack(rawDamagePhys)
    const autoAttackHq = calcAutoAttack(rawDamagePhysHq)

    if (
      damagePhys === 0 &&
      damageMag === 0 &&
      blockRate === 0 &&
      block === 0 &&
      defensePhys === 0 &&
      defenseMag === 0 &&
      bonuses.length === 0 &&
      materiaSlotCount === 0
    ) {
      return undefined
    }

    return {
      weaponKind,
      damagePhys,
      damagePhysHq,
      damageMag,
      damageMagHq,
      autoAttack,
      autoAttackHq,
      delaySec: delayMs > 0 ? Number((delayMs / 1000).toFixed(2)) : 0,
      blockRate,
      blockRateHq,
      block,
      blockHq,
      defensePhys,
      defensePhysHq,
      defenseMag,
      defenseMagHq,
      materiaSlotCount,
      isAdvancedMeldingPermitted,
      bonuses,
    }
  }

  /**
   * 提取食品或爆发药/药水的使用属性效果
   */
  private extractConsumableEffect(row: any[]): ConsumableEffect | undefined {
    const itemActionId = Number(row[30])
    if (itemActionId <= 0) return undefined
    const actionRow = this.store.itemActions.get(itemActionId)
    if (!actionRow) return undefined

    const actionType = Number(actionRow[4])
    const statusId = Number(actionRow[5])
    // Type 844/845/846 且 Status 48(进食)/49(强化药) 指向 ItemFood 表
    if (
      actionType !== 844 &&
      actionType !== 845 &&
      actionType !== 846 &&
      statusId !== 48 &&
      statusId !== 49
    ) {
      return undefined
    }

    const itemFoodId = Number(actionRow[6]) || Number(actionRow[5])
    const durationSec = Number(actionRow[7]) || 1800
    const foodRow = this.store.itemFoods.get(itemFoodId)
    if (!foodRow) return undefined

    const expBonusPercent = Number(foodRow[0])
    const params: ConsumableParamBonus[] = []

    for (let i = 0; i < 3; i++) {
      const baseOffset = 1 + i * 6
      const paramId = Number(foodRow[baseOffset])
      if (paramId <= 0) continue
      const isRelative = Boolean(foodRow[baseOffset + 1])
      const valueNq = Number(foodRow[baseOffset + 2])
      const maxNq = Number(foodRow[baseOffset + 3])
      const valueHq = Number(foodRow[baseOffset + 4])
      const maxHq = Number(foodRow[baseOffset + 5])
      const name = this.store.baseParams.get(paramId)?.name || `属性#${paramId}`
      params.push({
        paramId,
        name,
        isRelative,
        valueNq,
        maxNq,
        valueHq,
        maxHq,
      })
    }

    if (params.length === 0 && expBonusPercent === 0) return undefined

    const cooldownSec = Number(row[32])
    return {
      typeName: statusId === 48 ? '进食加成' : '强化药效',
      durationSec,
      cooldownSec,
      cooldownHqSec: cooldownSec > 0 ? Math.floor(cooldownSec * 0.9) : 0,
      expBonusPercent,
      params,
    }
  }

  /**
   * 构建产出指定道具的所有制作配方详情
   */
  private buildItemRecipes(itemId: number): RecipeDetail[] {
    const recipeIds = this.store.recipesByResultItem.get(itemId) || []
    const details: RecipeDetail[] = []

    for (const recipeId of recipeIds) {
      const rRow = this.store.recipes.get(recipeId)
      if (!rRow) continue

      const craftTypeId = Number(rRow[1])
      const craftInfo = this.store.craftTypes.get(craftTypeId)
      const rltId = Number(rRow[2])
      const rltRow = this.store.recipeLevelTables.get(rltId)

      const recipeLevel = rltRow ? Number(rltRow[0]) : 1
      const stars = rltRow ? Number(rltRow[1]) : 0
      const suggestedCraftsmanship = rltRow ? Number(rltRow[2]) : 0
      const baseDifficulty = rltRow ? Number(rltRow[3]) : 0
      const baseQuality = rltRow ? Number(rltRow[4]) : 0
      const baseDurability = rltRow ? Number(rltRow[9]) : 0

      const materialQualityFactor = Number(rRow[25])
      const difficultyFactor = Number(rRow[26]) || 100
      const qualityFactor = Number(rRow[27]) || 100
      const durabilityFactor = Number(rRow[28]) || 100

      const secretBookId = Number(rRow[35])
      const secretBookName =
        this.store.secretRecipeBooks.get(secretBookId)?.name || ''

      const ingredients: RecipeIngredient[] = []
      const crystals: RecipeIngredient[] = []

      // 槽位 0..5 为普通材料，槽位 6..7 为水晶/晶簇
      for (let i = 0; i < 8; i++) {
        const ingItemId = Number(rRow[6 + i * 2])
        const ingAmount = Number(rRow[7 + i * 2])
        if (ingItemId <= 0 || ingAmount <= 0) continue

        const ingSummary = this.store.itemSummaryById.get(ingItemId)
        if (!ingSummary) continue

        const entry: RecipeIngredient = {
          itemId: ingItemId,
          nameCn: ingSummary.nameCn,
          nameEn: ingSummary.nameEn,
          iconId: ingSummary.iconId,
          amount: ingAmount,
          itemLevel: ingSummary.itemLevel,
          isCraftable: ingSummary.isCraftable,
          isGatherable: ingSummary.isGatherable,
        }

        if (i >= 6 || ingSummary.categoryId === 59) {
          crystals.push(entry)
        } else {
          ingredients.push(entry)
        }
      }

      details.push({
        id: recipeId,
        craftTypeId,
        craftTypeName: craftInfo?.name || '制作',
        craftJobName: craftInfo?.jobName || '能工巧匠',
        craftJobIconId: craftInfo?.iconId || 62008,
        resultItemId: Number(rRow[4]),
        resultAmount: Number(rRow[5]) || 1,
        recipeLevel,
        stars,
        difficulty: Math.floor((baseDifficulty * difficultyFactor) / 100),
        quality: Math.floor((baseQuality * qualityFactor) / 100),
        durability: Math.floor((baseDurability * durabilityFactor) / 100),
        suggestedCraftsmanship,
        requiredCraftsmanship: Number(rRow[31]),
        requiredControl: Number(rRow[32]),
        materialQualityFactor,
        secretRecipeBookName: secretBookName,
        isSpecializationRequired: Boolean(rRow[42]),
        isExpert: Boolean(rRow[43]),
        canQuickSynth: Boolean(rRow[36]),
        canHq: Boolean(rRow[37]),
        ingredients,
        crystals,
      })
    }

    return details
  }

  /**
   * 针对指定配方递归构建配方树（防止环路，最大递归深度 5 层）
   */
  private buildRecipeTreeForRecipe(
    recipe: RecipeDetail,
    amountPerCraft: number,
    depth: number,
    visited: Set<number>,
  ): RecipeTreeNode | undefined {
    const summary = this.store.itemSummaryById.get(recipe.resultItemId)
    if (!summary) return undefined

    const nextVisited = new Set(visited)
    nextVisited.add(recipe.resultItemId)

    const children: RecipeTreeNode[] = []
    for (const ing of recipe.ingredients) {
      const childNode = this.buildRecipeTree(
        ing.itemId,
        ing.amount,
        depth + 1,
        nextVisited,
      )
      if (childNode) {
        children.push(childNode)
      }
    }

    return {
      itemId: recipe.resultItemId,
      nameCn: summary.nameCn,
      iconId: summary.iconId,
      amountPerCraft,
      yieldPerCraft: recipe.resultAmount,
      craftJobName: recipe.craftJobName,
      craftJobIconId: recipe.craftJobIconId,
      recipeLevel: recipe.recipeLevel,
      stars: recipe.stars,
      isGatherable: summary.isGatherable,
      children,
      crystals: recipe.crystals.map((c) => ({
        itemId: c.itemId,
        nameCn: c.nameCn,
        iconId: c.iconId,
        amount: c.amount,
      })),
    }
  }

  /**
   * 递归构建配方树（防止环路，最大递归深度 5 层）
   */
  private buildRecipeTree(
    itemId: number,
    amountPerCraft: number,
    depth: number,
    visited: Set<number>,
  ): RecipeTreeNode | undefined {
    const summary = this.store.itemSummaryById.get(itemId)
    if (!summary) return undefined

    const recipeIds = this.store.recipesByResultItem.get(itemId)
    if (!recipeIds || recipeIds.length === 0 || depth > 5 || visited.has(itemId)) {
      return {
        itemId,
        nameCn: summary.nameCn,
        iconId: summary.iconId,
        amountPerCraft,
        yieldPerCraft: 1,
        isGatherable: summary.isGatherable,
        children: [],
        crystals: [],
      }
    }

    const recipes = this.buildItemRecipes(itemId)
    const primary = recipes[0]
    if (!primary) return undefined

    return this.buildRecipeTreeForRecipe(
      primary,
      amountPerCraft,
      depth,
      visited,
    )
  }

  /**
   * 构建将该道具作为原料的下游配方列表
   */
  private buildUsedInRecipes(itemId: number): UsedInRecipeItem[] {
    const usages = this.store.recipesByIngredientItem.get(itemId) || []
    const results: UsedInRecipeItem[] = []
    const seenRecipes = new Set<number>()

    for (const { recipeId, amount } of usages) {
      if (seenRecipes.has(recipeId)) continue
      seenRecipes.add(recipeId)

      const rRow = this.store.recipes.get(recipeId)
      if (!rRow) continue
      const resultItemId = Number(rRow[4])
      const resultSummary = this.store.itemSummaryById.get(resultItemId)
      if (!resultSummary) continue

      const craftTypeId = Number(rRow[1])
      const craftInfo = this.store.craftTypes.get(craftTypeId)
      const rltRow = this.store.recipeLevelTables.get(Number(rRow[2]))

      results.push({
        recipeId,
        resultItemId,
        resultNameCn: resultSummary.nameCn,
        resultIconId: resultSummary.iconId,
        resultItemLevel: resultSummary.itemLevel,
        amountRequired: amount,
        craftJobName: craftInfo?.jobName || '能工巧匠',
        craftJobIconId: craftInfo?.iconId || 62008,
        recipeLevel: rltRow ? Number(rltRow[0]) : 1,
        stars: rltRow ? Number(rltRow[1]) : 0,
      })

      if (results.length >= 60) break
    }

    return results.sort(
      (a, b) =>
        b.recipeLevel - a.recipeLevel || b.resultItemLevel - a.resultItemLevel,
    )
  }

  /**
   * 构建道具的采集点、垂钓点与刺鱼渔场详情
   */
  private buildGatheringDetail(itemId: number): GatheringMethodDetail {
    const nodes = this.buildGatheringNodes(itemId)
    const fishingSpots = this.buildFishingSpots(itemId)
    const spearfishing = this.buildSpearfishing(itemId)

    return {
      nodes,
      fishingSpots,
      spearfishing,
    }
  }

  /**
   * 解析采矿工与园艺工采集点信息
   */
  private buildGatheringNodes(itemId: number): GatheringNodeInfo[] {
    const gItemIds = this.store.gatheringItemsByItem.get(itemId) || []
    const nodes: GatheringNodeInfo[] = []
    const deduplicateKeySet = new Set<string>()

    for (const gItemId of gItemIds) {
      const gItemRow = this.store.gatheringItems.get(gItemId)
      if (!gItemRow) continue

      const gLevelId = Number(gItemRow[1])
      const gLevelInfo = this.store.gatheringItemLevels.get(gLevelId) || {
        level: 1,
        stars: 0,
      }
      const isHidden = Boolean(gItemRow[2])

      const pointIds =
        this.store.gatheringPointsByGatheringItem.get(gItemId) || []
      for (const pointId of pointIds) {
        const ptRow = this.store.gatheringPoints.get(pointId)
        if (!ptRow) continue

        const baseId = Number(ptRow[3])
        const territoryId = Number(ptRow[7])
        const placeNameId = Number(ptRow[8])
        const subCategoryId = Number(ptRow[9])
        if (baseId <= 0 || territoryId <= 1) continue

        // 同一地图同一采集点基底去重，避免重复展示相同刷点
        const dedupKey = `${baseId}:${territoryId}:${placeNameId}`
        if (deduplicateKeySet.has(dedupKey)) continue
        deduplicateKeySet.add(dedupKey)

        const baseRow = this.store.gatheringPointBases.get(baseId)
        if (!baseRow) continue

        const gatheringTypeId = Number(baseRow[0])
        const nodeLevel = Number(baseRow[1])
        const gTypeInfo = this.store.gatheringTypes.get(gatheringTypeId)
        const isMiner = gatheringTypeId === 0 || gatheringTypeId === 1

        const loc = this.resolveTerritoryAndMap(territoryId)
        if (!loc) continue

        const placeName =
          this.store.placeNames.get(placeNameId) || loc.zoneName

        // 坐标解析（ExportedGatheringPoint 行号与 GatheringPointBase 一致）
        const expRow = this.store.exportedGatheringPoints.get(baseId)
        let coordX = 21.5
        let coordY = 21.5
        let normX = 0.5
        let normY = 0.5
        let radius = 50
        if (expRow) {
          const worldX = Number(expRow[0])
          const worldY = Number(expRow[1])
          radius = Number(expRow[4]) || 50
          const converted = convertWorldCoordToMap(
            worldX,
            worldY,
            loc.sizeFactor,
            loc.offsetX,
            loc.offsetY,
          )
          coordX = converted.coordX
          coordY = converted.coordY
          normX = converted.normX
          normY = converted.normY
        }

        const folkloreBookName =
          this.store.gatheringSubCategories.get(subCategoryId)?.name || ''

        const { isTimed, isEphemeral, timeWindows } =
          this.extractGatheringTimeWindows(pointId)

        nodes.push({
          pointId,
          baseId,
          gatheringTypeId,
          gatheringTypeName: gTypeInfo?.name || '采集',
          disciplineName: isMiner ? '采矿工' : '园艺工',
          disciplineIconId: isMiner ? 62016 : 62017,
          gatheringTypeIconId: gTypeInfo?.iconId || 60438,
          nodeLevel,
          itemLevel: gLevelInfo.level,
          stars: gLevelInfo.stars,
          isHidden,
          regionName: loc.regionName,
          zoneName: loc.zoneName,
          placeName,
          territoryId,
          mapId: loc.mapId,
          mapPath: loc.mapPath,
          sizeFactor: loc.sizeFactor,
          coordX,
          coordY,
          normX,
          normY,
          radius,
          folkloreBookName,
          isTimed,
          isEphemeral,
          timeWindows,
        })
      }
    }

    return nodes
  }

  /**
   * 解析限时采集点与精选采集点的艾欧泽亚时间 (ET) 出现窗口
   */
  private extractGatheringTimeWindows(pointId: number): {
    isTimed: boolean
    isEphemeral: boolean
    timeWindows: GatheringTimeWindow[]
  } {
    const trRow = this.store.gatheringPointTransients.get(pointId)
    if (!trRow) {
      return { isTimed: false, isEphemeral: false, timeWindows: [] }
    }

    const ephStart = Number(trRow[0])
    const ephEnd = Number(trRow[1])
    const rarePopId = Number(trRow[2])
    const timeWindows: GatheringTimeWindow[] = []
    let isEphemeral = false

    if (ephStart !== 65535 && ephEnd !== 65535 && ephStart !== ephEnd) {
      isEphemeral = true
      const startMin = hhmmToMinutes(ephStart)
      const endMin = hhmmToMinutes(ephEnd)
      const durMin =
        endMin > startMin ? endMin - startMin : 1440 - startMin + endMin
      timeWindows.push({
        startEt: minutesToTimeStr(startMin),
        endEt: minutesToTimeStr(endMin),
        startMinuteOfDay: startMin,
        durationMinutes: durMin,
      })
    }

    if (rarePopId > 0) {
      const popRow = this.store.gatheringRarePopTimeTables.get(rarePopId)
      if (popRow) {
        for (let i = 0; i < 3; i++) {
          const startHhmm = Number(popRow[i * 2])
          const durHhmm = Number(popRow[i * 2 + 1])
          if (startHhmm < 2400 && durHhmm > 0) {
            const startMin = hhmmToMinutes(startHhmm)
            const durMin = hhmmToMinutes(durHhmm)
            const endMin = (startMin + durMin) % 1440
            timeWindows.push({
              startEt: minutesToTimeStr(startMin),
              endEt: minutesToTimeStr(endMin),
              startMinuteOfDay: startMin,
              durationMinutes: durMin,
            })
          }
        }
      }
    }

    return {
      isTimed: timeWindows.length > 0,
      isEphemeral,
      timeWindows,
    }
  }

  /**
   * 解析捕鱼人垂钓钓场信息
   */
  private buildFishingSpots(itemId: number): FishingSpotInfo[] {
    const spotIds = this.store.fishingSpotsByItem.get(itemId) || []
    if (spotIds.length === 0) return []

    const fishParamRow = this.store.fishParametersByItem.get(itemId)
    const fishGuideText = fishParamRow ? decodeSeString(fishParamRow[0]) : ''
    const subCategoryId = fishParamRow ? Number(fishParamRow[11]) : 0
    const folkloreBookName =
      this.store.gatheringSubCategories.get(subCategoryId)?.name || ''

    const spots: FishingSpotInfo[] = []
    for (const spotId of spotIds) {
      const row = this.store.fishingSpots.get(spotId)
      if (!row) continue

      const level = Number(row[0])
      const catId = Number(row[4])
      const territoryId = Number(row[6])
      const pixelX = Number(row[9])
      const pixelY = Number(row[10])
      const radius = Number(row[11]) || 400
      const placeNameId = Number(row[23])

      const loc = this.resolveTerritoryAndMap(territoryId)
      if (!loc) continue

      const { coordX, coordY, normX, normY } = convertPixelCoordToMap(
        pixelX,
        pixelY,
        loc.sizeFactor,
      )

      spots.push({
        spotId,
        level,
        categoryName: FISHING_SPOT_CATEGORIES[catId] || '垂钓',
        regionName: loc.regionName,
        zoneName: loc.zoneName,
        placeName: this.store.placeNames.get(placeNameId) || loc.zoneName,
        territoryId,
        mapId: loc.mapId,
        mapPath: loc.mapPath,
        sizeFactor: loc.sizeFactor,
        coordX,
        coordY,
        normX,
        normY,
        radius,
        fishGuideText,
        folkloreBookName,
      })
    }

    return spots
  }

  /**
   * 解析捕鱼人刺鱼渔场信息
   */
  private buildSpearfishing(itemId: number): SpearfishingInfo[] {
    const entries = this.store.spearfishingByItem.get(itemId) || []
    const results: SpearfishingInfo[] = []

    for (const { spearfishingItemRow, notebookId, notebookRow } of entries) {
      const description = decodeSeString(spearfishingItemRow[0])
      const gLevelId = Number(spearfishingItemRow[2])
      const itemLevel =
        this.store.gatheringItemLevels.get(gLevelId)?.level || 1

      const level = Number(notebookRow[0])
      const territoryId = Number(notebookRow[2])
      const pixelX = Number(notebookRow[3])
      const pixelY = Number(notebookRow[4])
      const radius = Number(notebookRow[5]) || 400
      const placeNameId = Number(notebookRow[7])

      const loc = this.resolveTerritoryAndMap(territoryId)
      if (!loc) continue

      const { coordX, coordY, normX, normY } = convertPixelCoordToMap(
        pixelX,
        pixelY,
        loc.sizeFactor,
      )

      results.push({
        notebookId,
        level,
        itemLevel,
        regionName: loc.regionName,
        zoneName: loc.zoneName,
        placeName: this.store.placeNames.get(placeNameId) || loc.zoneName,
        territoryId,
        mapId: loc.mapId,
        mapPath: loc.mapPath,
        sizeFactor: loc.sizeFactor,
        coordX,
        coordY,
        normX,
        normY,
        radius,
        description,
      })
    }

    return results
  }

  /**
   * 构建道具的 NPC 商店购买与兑换途径详情（含金币商店、特殊兑换、军票及部队战绩，并关联 NPC 地图坐标）
   */
  private buildShopSources(itemId: number): ShopPurchaseSource[] {
    const rawEntries = this.store.shopsByItem.get(itemId) || []
    if (rawEntries.length === 0) return []

    const mergedByKey = new Map<
      string,
      {
        source: ShopPurchaseSource
        seenNpcs: Set<number>
      }
    >()

    for (const raw of rawEntries) {
      const costs: ShopCostItem[] = raw.costs.map((c) => {
        if (c.nameCn && c.iconId) {
          return {
            itemId: c.itemId,
            nameCn: c.nameCn,
            iconId: c.iconId,
            amount: c.amount,
            collectability: c.collectability,
          }
        }
        const costSummary = this.store.itemSummaryById.get(c.itemId)
        if (costSummary) {
          return {
            itemId: c.itemId,
            nameCn: costSummary.nameCn,
            iconId: costSummary.iconId,
            amount: c.amount,
            collectability: c.collectability,
          }
        }
        const costRow = this.store.itemsCn.get(c.itemId)
        return {
          itemId: c.itemId,
          nameCn: costRow ? decodeSeString(costRow[9]) || `货币#${c.itemId}` : `货币#${c.itemId}`,
          iconId: costRow ? Number(costRow[10]) || 65002 : 65002,
          amount: c.amount,
          collectability: c.collectability,
        }
      })

      const costsKey = costs.map((c) => `${c.itemId}:${c.amount}`).join('|')
      const mergeKey = `${raw.shopType}:${raw.shopName}:${raw.receiveAmount}:${raw.receiveHq ? 1 : 0}:${costsKey}`

      let group = mergedByKey.get(mergeKey)
      if (!group) {
        group = {
          source: {
            shopId: raw.shopId,
            shopType: raw.shopType,
            shopTypeLabel: raw.shopTypeLabel,
            shopName: raw.shopName,
            receiveAmount: raw.receiveAmount,
            receiveHq: raw.receiveHq,
            costs,
            npcs: [],
          },
          seenNpcs: new Set<number>(),
        }
        mergedByKey.set(mergeKey, group)
      }

      for (const npcId of raw.npcIds) {
        if (group.seenNpcs.has(npcId) || group.source.npcs.length >= 16) continue
        const npcInfo = this.store.npcNames.get(npcId)
        if (!npcInfo) continue
        group.seenNpcs.add(npcId)

        const rawLoc = this.store.npcLocations.get(npcId)
        let regionName = ''
        let zoneName = ''
        let placeName = ''
        let territoryId = 0
        let mapId = 0
        let mapPath = ''
        let sizeFactor = 100
        let coordX = 0
        let coordY = 0
        let normX = 0.5
        let normY = 0.5

        if (rawLoc) {
          const tLoc = this.resolveTerritoryAndMap(rawLoc.territoryId)
          if (tLoc) {
            regionName = tLoc.regionName
            zoneName = tLoc.zoneName
            placeName = tLoc.zoneName
            territoryId = rawLoc.territoryId
            mapId = rawLoc.mapId || tLoc.mapId
            mapPath = tLoc.mapPath
            sizeFactor = tLoc.sizeFactor
            let offsetX = tLoc.offsetX
            let offsetY = tLoc.offsetY

            const specificMap = this.store.maps.get(mapId)
            if (specificMap) {
              const spPath = decodeSeString(specificMap[6])
              if (spPath) mapPath = spPath
              sizeFactor = Number(specificMap[7]) || sizeFactor
              offsetX = Number(specificMap[8]) || 0
              offsetY = Number(specificMap[9]) || 0
              const subPlaceId = Number(specificMap[12]) || Number(specificMap[11])
              const subPlace = this.store.placeNames.get(subPlaceId)
              if (subPlace) placeName = subPlace
            }

            const converted = convertWorldCoordToMap(
              rawLoc.worldX,
              rawLoc.worldZ,
              sizeFactor,
              offsetX,
              offsetY,
            )
            coordX = converted.coordX
            coordY = converted.coordY
            normX = converted.normX
            normY = converted.normY
          }
        }

        const vendor: ShopVendorNpc = {
          npcId,
          npcName: npcInfo.name,
          npcTitle: npcInfo.title,
          regionName,
          zoneName,
          placeName,
          territoryId,
          mapId,
          mapPath,
          sizeFactor,
          coordX,
          coordY,
          normX,
          normY,
        }
        group.source.npcs.push(vendor)
      }
    }

    const result = Array.from(mergedByKey.values()).map((g) => {
      g.source.npcs.sort((a, b) => (b.mapPath ? 1 : 0) - (a.mapPath ? 1 : 0))
      return g.source
    })

    result.sort((a, b) => {
      const aHasCoord = a.npcs.some((n) => Boolean(n.mapPath)) ? 1 : 0
      const bHasCoord = b.npcs.some((n) => Boolean(n.mapPath)) ? 1 : 0
      if (aHasCoord !== bHasCoord) return bHasCoord - aHasCoord
      return b.npcs.length - a.npcs.length
    })

    return result
  }

  /**
   * 根据 TerritoryType ID 解析所属大区、地图名与 Map 坐标参数
   */
  private resolveTerritoryAndMap(territoryId: number): {
    regionName: string
    zoneName: string
    mapId: number
    mapPath: string
    sizeFactor: number
    offsetX: number
    offsetY: number
  } | null {
    const tRow = this.store.territoryTypes.get(territoryId)
    if (!tRow) return null

    const regionPlaceId = Number(tRow[3])
    const zonePlaceId = Number(tRow[5]) || Number(tRow[4])
    const mapId = Number(tRow[6])
    const mapRow = this.store.maps.get(mapId)

    const regionName = this.store.placeNames.get(regionPlaceId) || '艾欧泽亚'
    const zoneName = this.store.placeNames.get(zonePlaceId) || '未知区域'
    const mapPath = mapRow ? decodeSeString(mapRow[6]) : ''
    const sizeFactor = mapRow ? Number(mapRow[7]) || 100 : 100
    const offsetX = mapRow ? Number(mapRow[8]) || 0 : 0
    const offsetY = mapRow ? Number(mapRow[9]) || 0 : 0

    return {
      regionName,
      zoneName,
      mapId,
      mapPath,
      sizeFactor,
      offsetX,
      offsetY,
    }
  }

  /**
   * 搜索与多条件筛选成就与称号列表
   */
  searchAchievements(query: AchievementSearchQuery): AchievementSearchResponse {
    const q = (query.q || '').trim().toLowerCase()
    const numericQuery = /^\d+$/.test(q) ? Number(q) : null
    const kindId = query.kindId ? Number(query.kindId) : 0
    const filter = query.filter || 'all'

    const filtered = this.store.achievements.filter((ach) => {
      if (kindId > 0 && ach.kindId !== kindId) return false
      if (filter === 'with_title' && ach.titleId <= 0) return false
      if (filter === 'with_item' && ach.rewardItemId <= 0) return false

      if (q) {
        if (numericQuery !== null && ach.id === numericQuery) return true
        return (
          ach.nameCn.toLowerCase().includes(q) ||
          ach.nameEn.toLowerCase().includes(q) ||
          ach.nameJa.toLowerCase().includes(q) ||
          ach.descriptionCn.toLowerCase().includes(q) ||
          ach.titleMasculineCn.toLowerCase().includes(q) ||
          ach.titleFeminineCn.toLowerCase().includes(q) ||
          ach.titleNameEn.toLowerCase().includes(q) ||
          ach.titleNameJa.toLowerCase().includes(q) ||
          ach.rewardItemNameCn.toLowerCase().includes(q) ||
          String(ach.id) === q
        )
      }
      return true
    })

    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 30))
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.max(1, Math.min(totalPages, Number(query.page) || 1))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * 读取并解码道具或职业图标 PNG
   */
  async getIconPng(iconId: number, isHq = false): Promise<Buffer | null> {
    return readIconPng(this.store.cnReader, iconId, isHq)
  }

  /**
   * 读取并解码游戏地图贴图 PNG
   */
  async getMapPng(mapPath: string): Promise<Buffer | null> {
    return readMapPng(this.store.cnReader, mapPath)
  }

  /**
   * 释放底层 SqPack 文件句柄
   */
  async close(): Promise<void> {
    await Promise.all([
      this.store.cnReader.close(),
      this.store.globalReader.close(),
    ])
  }
}
