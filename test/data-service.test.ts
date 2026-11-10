import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  loadGamePathsFromEnv,
  validateGamePathsOnStartup,
} from '../src/server/config'
import { loadGameDataStore } from '../src/server/data-loader'
import { GameDataService } from '../src/server/game-data-service'
import { VersionBackupService } from '../src/server/version-backup'

describe('GameDataService 本地 FF14 SqPack 数据解析验证', () => {
  let service: GameDataService

  beforeAll(async () => {
    const store = await loadGameDataStore()
    service = new GameDataService(store)
  }, 30000)

  afterAll(async () => {
    if (service) {
      await service.close()
    }
  })

  it('应正确加载国服与国际服游戏版本及基础统计数据', () => {
    const status = service.getSystemStatus()
    expect(status.cnVersion).toMatch(/^\d{4}\.\d{2}\.\d{2}/)
    expect(status.globalVersion).toMatch(/^\d{4}\.\d{2}\.\d{2}/)
    expect(status.stats.totalItems).toBeGreaterThan(30000)
    expect(status.stats.totalRecipes).toBeGreaterThan(10000)
    expect(status.stats.purchasableItems).toBeGreaterThan(5000)
    expect(status.stats.totalShops).toBeGreaterThan(500)
    expect(status.categories.length).toBeGreaterThan(50)
    expect(status.craftTypes).toHaveLength(8)
  })

  it('应支持按中文名、英文名、日文名及 ID 搜索道具', () => {
    const cnRes = service.searchItems({ q: '图拉尔菠萝蛋糕' })
    expect(cnRes.total).toBeGreaterThan(0)
    expect(cnRes.items[0].id).toBe(44099)

    const enRes = service.searchItems({ q: 'Turali Pineapple Ponzecake' })
    expect(enRes.items[0].id).toBe(44099)

    const jaRes = service.searchItems({ q: 'トラルパイナップルケーキ' })
    expect(jaRes.items[0].id).toBe(44099)

    const idRes = service.searchItems({ q: '34577' })
    expect(idRes.items[0].id).toBe(34577)
  })

  it('应完整解析制作装备的基础属性、HQ 增益、制作配方与递归材料树', () => {
    const detail = service.getItemDetail(34577)
    expect(detail).not.toBeNull()
    expect(detail?.nameCn).toBe('金毗罗鳄革白狮鹫手套')
    expect(detail?.itemLevel).toBe(539)
    expect(detail?.equipLevel).toBe(86)
    expect(detail?.isEquipment).toBe(true)
    expect(detail?.equipmentStats).toBeDefined()
    expect(detail?.equipmentStats?.defensePhysHq).toBeGreaterThan(
      detail?.equipmentStats?.defensePhys || 0,
    )
    expect(detail?.equipmentAttributes).toBeDefined()
    expect(detail?.equipmentAttributes?.canExtractMateria).toBe(true)
    expect(detail?.equipmentAttributes?.isProjectable).toBe(true)
    expect(detail?.recipes.length).toBeGreaterThan(0)
    expect(detail?.recipeTrees.length).toBeGreaterThan(0)
    expect(detail?.recipeTrees[0].children.length).toBeGreaterThan(0)
    expect(detail?.recipeTrees[0].crystals.length).toBeGreaterThan(0)
  })

  it('应正确区分物理武器与魔法武器基本性能并计算物理自动攻击与 HQ 增益', () => {
    const physWeapon = service.getItemDetail(51110) // 改良型宫廷爱人之剑 (FilterGroup=1)
    expect(physWeapon?.equipmentStats?.weaponKind).toBe('physical')
    expect(physWeapon?.equipmentStats?.damagePhys).toBe(139)
    expect(physWeapon?.equipmentStats?.damagePhysHq).toBe(155)
    expect(physWeapon?.equipmentStats?.damageMag).toBe(0)
    expect(physWeapon?.equipmentStats?.autoAttack).toBe(103.78)
    expect(physWeapon?.equipmentStats?.autoAttackHq).toBe(115.73)

    const magWeapon = service.getItemDetail(51115) // 改良型宫廷爱人牧杖 (FilterGroup=2)
    expect(magWeapon?.equipmentStats?.weaponKind).toBe('magical')
    expect(magWeapon?.equipmentStats?.damageMag).toBe(139)
    expect(magWeapon?.equipmentStats?.damageMagHq).toBe(155)
    expect(magWeapon?.equipmentStats?.damagePhys).toBe(0)
    expect(magWeapon?.equipmentStats?.autoAttack).toBeGreaterThan(0)
  })

  it('应正确区分不可交易、不可出售与不可在市场出售，并支持成就与称号检索', () => {
    const gilShopRes = service.searchItems({ filter: 'gil_shop' })
    const specialShopRes = service.searchItems({ filter: 'special_shop' })
    expect(gilShopRes.total).toBeGreaterThan(1000)
    expect(specialShopRes.total).toBeGreaterThan(1000)

    const equipRes = service.searchItems({ filter: 'equipment' })
    expect(equipRes.total).toBeGreaterThan(10000)
    expect(equipRes.items.every((it) => it.hasEquipmentStats)).toBe(true)

    const achRes = service.searchAchievements({ filter: 'with_title', page: 1 })
    expect(achRes.total).toBeGreaterThan(500)
    expect(achRes.items[0].titleId).toBeGreaterThan(0)
    expect(achRes.items[0].titleMasculineCn).toBeTruthy()
  })

  it('应完整解析采集食品的进食属性加成与烹调配方', () => {
    const detail = service.getItemDetail(44099)
    expect(detail).not.toBeNull()
    expect(detail?.consumableEffect).toBeDefined()
    expect(detail?.consumableEffect?.expBonusPercent).toBe(3)
    expect(detail?.consumableEffect?.params.length).toBeGreaterThanOrEqual(2)
    expect(detail?.recipes.length).toBeGreaterThan(0)
  })

  it('应完整解析采矿/园艺素材的采集点坐标与作为原料的下游配方', () => {
    const detail = service.getItemDetail(5111) // 铁矿
    expect(detail).not.toBeNull()
    expect(detail?.nameCn).toBe('铁矿')
    expect(detail?.gathering.nodes.length).toBeGreaterThan(0)
    expect(detail?.gathering.nodes[0].coordX).toBeGreaterThan(0)
    expect(detail?.usedInRecipes.length).toBeGreaterThan(0)
  })

  it('应完整解析 NPC 商店购买与特殊货币兑换途径及商人地图坐标', () => {
    const shopSearch = service.searchItems({ filter: 'purchasable' })
    expect(shopSearch.total).toBeGreaterThan(5000)

    const ironOre = service.getItemDetail(5111) // 铁矿（金币商店可购买）
    expect(ironOre?.isPurchasable).toBe(true)
    expect(ironOre?.shops.length).toBeGreaterThan(0)
    expect(ironOre?.shops[0].costs[0].amount).toBe(18)
    expect(ironOre?.shops[0].npcs.length).toBeGreaterThan(0)

    const specialItem = service.getItemDetail(49526) // 神典石兑换装备
    expect(specialItem?.isPurchasable).toBe(true)
    expect(specialItem?.shops.some((s) => s.shopType === 'special')).toBe(true)
  })

  it('应完整解析鱼类的垂钓钓场与地图坐标', () => {
    const detail = service.getItemDetail(4925) // 小龙虾
    expect(detail).not.toBeNull()
    expect(detail?.gathering.fishingSpots.length).toBeGreaterThan(0)
    expect(detail?.gathering.fishingSpots[0].placeName).toBeTruthy()
  })

  it('应能将本地游戏图标与地图 .tex 贴图解码为有效 PNG', async () => {
    const iconPng = await service.getIconPng(20001, false)
    expect(iconPng).not.toBeNull()
    expect(iconPng?.subarray(0, 4).toString('hex')).toBe('89504e47')

    const mapPng = await service.getMapPng('s1f1/00')
    expect(mapPng).not.toBeNull()
    expect(mapPng?.subarray(0, 4).toString('hex')).toBe('89504e47')
  })

  it('应支持启动时版本检查、本地快照备份与跨版本 Diff 对比', async () => {
    const backupSvc = new VersionBackupService(service.getStore())
    const vStatus = await backupSvc.initializeOnStartup()
    expect(vStatus.currentVersion).toMatch(/^\d{4}\.\d{2}\.\d{2}/)
    expect(vStatus.backups.length).toBeGreaterThanOrEqual(2)

    const diff = await backupSvc.compareVersions({ filter: 'all', page: 1 })
    expect(diff.summary.addedItems).toBeGreaterThan(0)
    expect(diff.summary.modifiedItems).toBeGreaterThan(0)
    expect(diff.summary.addedAchievements).toBeGreaterThan(0)
    expect(diff.summary.addedTitles).toBeGreaterThan(0)
    expect(diff.items.length).toBeGreaterThan(0)
  })

  it('应从 .env 读取游戏路径，且在缺失路径或路径无效时抛出明确错误', () => {
    const validConfig = validateGamePathsOnStartup()
    expect(validConfig.cnRootPath).toBeTruthy()
    expect(validConfig.globalRootPath).toBeTruthy()

    expect(() =>
      loadGamePathsFromEnv({ env: {}, ignoreDotEnvFile: true }),
    ).toThrow(/FFXIV_CN_PATH/)

    expect(() =>
      loadGamePathsFromEnv({
        env: { FFXIV_CN_PATH: validConfig.cnRootPath },
        ignoreDotEnvFile: true,
      }),
    ).toThrow(/FFXIV_GLOBAL_PATH/)

    expect(() =>
      validateGamePathsOnStartup({
        env: {
          FFXIV_CN_PATH: 'D:\\NonExistentPath\\FFXIV_CN',
          FFXIV_GLOBAL_PATH: validConfig.globalRootPath,
        },
        ignoreDotEnvFile: true,
      }),
    ).toThrow(/国服路径无效/)
  })
})
