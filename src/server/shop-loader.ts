import type { IExdDataSubRow } from '@ffcafe/elpis-sqpack'
import { decodeSeString } from './sqpack-helper'

export interface RawShopCost {
  itemId: number
  nameCn?: string
  iconId?: number
  amount: number
  collectability?: number
}

export interface RawShopEntry {
  shopId: number
  shopType: 'gil' | 'special' | 'gc' | 'fcc'
  shopTypeLabel: string
  shopName: string
  receiveAmount: number
  receiveHq: boolean
  costs: RawShopCost[]
  npcIds: number[]
}

export interface RawNpcLocation {
  territoryId: number
  mapId: number
  worldX: number
  worldZ: number
}

export interface ShopIndices {
  shopsByItem: Map<number, RawShopEntry[]>
  npcNames: Map<number, { name: string; title: string }>
  npcLocations: Map<number, RawNpcLocation>
  totalActiveShops: number
}

/**
 * 解析 SpecialShop 中特殊货币类型代号到真实道具 ID 的映射
 */
function resolveSpecialCurrencyId(
  rawCostId: number,
  useCurrencyType: number,
  tomestoneByIndex: Map<number, number>,
): number {
  if (rawCostId <= 0 || rawCostId >= 100) return rawCostId
  if (useCurrencyType === 2) {
    return tomestoneByIndex.get(rawCostId) || rawCostId
  }
  if (useCurrencyType === 16 || useCurrencyType === 4) {
    switch (rawCostId) {
      case 1:
        return 28 // 亚拉戈诗学神典石
      case 2:
        return 33913 // 巧手紫票
      case 3:
        return tomestoneByIndex.get(3) || 49 // 亚拉戈记忆神典石
      case 4:
        return 33914 // 大地紫票
      case 6:
        return 41784 // 巧手橙票
      case 7:
        return 41785 // 大地橙票
      default:
        return rawCostId
    }
  }
  if (useCurrencyType === 8 && rawCostId === 1) {
    return 1 // 金币
  }
  return rawCostId
}

/**
 * 递归追踪 ENpcData 引用链（PreHandler / TopicSelect / InclusionShop / CustomTalk）以定位关联商店 ID
 */
function createRefResolver(
  preHandler: Map<number, any[]>,
  topicSelect: Map<number, any[]>,
  inclusionShop: Map<number, any[]>,
  inclusionCat: Map<number, any[]>,
  inclusionSeries: Map<number, IExdDataSubRow[]>,
  customTalk: Map<number, any[]>,
  shopFallbackNames: Map<number, string>,
) {
  const memo = new Map<number, number[]>()

  const resolve = (refId: number, contextTitle = ''): number[] => {
    if (refId <= 0) return []
    const isDirectShop =
      (refId >= 262144 && refId < 270000) ||
      (refId >= 1769472 && refId < 1780000)
    if (isDirectShop) {
      if (contextTitle && !shopFallbackNames.has(refId)) {
        shopFallbackNames.set(refId, contextTitle)
      }
      return [refId]
    }

    if (memo.has(refId)) {
      const cached = memo.get(refId)!
      if (contextTitle) {
        for (const sid of cached) {
          if (!shopFallbackNames.has(sid)) {
            shopFallbackNames.set(sid, contextTitle)
          }
        }
      }
      return cached
    }

    const result: number[] = []
    memo.set(refId, result)

    // PreHandler (3538944..)
    const ph = preHandler.get(refId)
    if (ph) {
      result.push(...resolve(Number(ph[2]), contextTitle))
      return result
    }

    // TopicSelect (3276800..)
    const ts = topicSelect.get(refId)
    if (ts) {
      const topicName = decodeSeString(ts[0]) || contextTitle
      for (let i = 4; i <= 13; i++) {
        const sub = Number(ts[i])
        if (sub > 0) {
          result.push(...resolve(sub, topicName))
        }
      }
      return result
    }

    // InclusionShop (3801088..)
    const inc = inclusionShop.get(refId)
    if (inc) {
      for (let i = 3; i < inc.length; i++) {
        const catId = Number(inc[i])
        if (catId <= 0) continue
        const cat = inclusionCat.get(catId)
        if (!cat) continue
        const catName = decodeSeString(cat[0]) || contextTitle
        const seriesId = Number(cat[2])
        const subs = inclusionSeries.get(seriesId) || []
        for (const sub of subs) {
          const spId = Number(sub.data[0])
          if (spId > 0) {
            result.push(...resolve(spId, catName))
          }
        }
      }
      return result
    }

    // CustomTalk (720896..)
    const ct = customTalk.get(refId)
    if (ct) {
      for (const colVal of ct) {
        const num = Number(colVal)
        if (
          (num >= 262144 && num < 270000) ||
          (num >= 1769472 && num < 1780000) ||
          (num >= 3276800 && num < 3900000)
        ) {
          result.push(...resolve(num, contextTitle))
        }
      }
      return result
    }

    return result
  }

  return resolve
}

/**
 * 构建全量 NPC 商店（金币商店、特殊兑换、军票商店、部队战绩商店）与 NPC 坐标反向索引
 */
export function buildShopIndices(params: {
  itemsCn: Map<number, any[]>
  gilShops: Map<number, any[]>
  gilShopItems: Map<number, IExdDataSubRow[]>
  specialShops: Map<number, any[]>
  gcScripShopItems: Map<number, IExdDataSubRow[]>
  fccShops: Map<number, any[]>
  tomestonesItems: Map<number, any[]>
  enpcResidents: Map<number, any[]>
  enpcBases: Map<number, any[]>
  topicSelects: Map<number, any[]>
  preHandlers: Map<number, any[]>
  inclusionShops: Map<number, any[]>
  inclusionCategories: Map<number, any[]>
  inclusionSeries: Map<number, IExdDataSubRow[]>
  customTalks: Map<number, any[]>
  levels: Map<number, any[]>
}): ShopIndices {
  const {
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
  } = params

  // 1. 解析 NPC 名称与头衔
  const npcNames = new Map<number, { name: string; title: string }>()
  for (const [npcId, row] of enpcResidents.entries()) {
    const name = decodeSeString(row[0])
    if (!name) continue
    const title = decodeSeString(row[8]) || decodeSeString(row[7]) || ''
    npcNames.set(npcId, { name, title })
  }

  // 2. 从 Level 表提取 EventNpc (Type === 8) 的世界坐标与所属地图
  const npcLocations = new Map<number, RawNpcLocation>()
  for (const [, row] of levels.entries()) {
    if (Number(row[5]) !== 8) continue
    const npcId = Number(row[6])
    const mapId = Number(row[7])
    const territoryId = Number(row[9])
    if (npcId <= 0 || territoryId <= 0 || npcLocations.has(npcId)) continue
    npcLocations.set(npcId, {
      territoryId,
      mapId,
      worldX: Number(row[0]),
      worldZ: Number(row[2]),
    })
  }

  // 3. 建立 ShopID -> NPC 列表关联
  const shopFallbackNames = new Map<number, string>()
  const resolveRef = createRefResolver(
    preHandlers,
    topicSelects,
    inclusionShops,
    inclusionCategories,
    inclusionSeries,
    customTalks,
    shopFallbackNames,
  )

  const shopToNpcs = new Map<number, number[]>()
  for (const [npcId, row] of enpcBases.entries()) {
    if (!npcNames.has(npcId)) continue
    for (let i = 2; i <= 33; i++) {
      const refId = Number(row[i])
      if (refId <= 0) continue
      const shopIds = resolveRef(refId)
      for (const shopId of shopIds) {
        let list = shopToNpcs.get(shopId)
        if (!list) {
          list = []
          shopToNpcs.set(shopId, list)
        }
        if (!list.includes(npcId)) {
          list.push(npcId)
        }
      }
    }
  }

  // 4. 神典石索引映射
  const tomestoneByIndex = new Map<number, number>()
  for (const [, row] of tomestonesItems.entries()) {
    const itemId = Number(row[0])
    const idx = Number(row[2])
    if (itemId > 0 && idx > 0) {
      tomestoneByIndex.set(idx, itemId)
    }
  }

  const shopsByItem = new Map<number, RawShopEntry[]>()
  const activeShopIds = new Set<number>()

  const addShopEntry = (itemId: number, entry: RawShopEntry) => {
    let list = shopsByItem.get(itemId)
    if (!list) {
      list = []
      shopsByItem.set(itemId, list)
    }
    list.push(entry)
    activeShopIds.add(entry.shopId)
  }

  // 5. 解析 GilShopItem (金币商店)
  for (const [shopId, subrows] of gilShopItems.entries()) {
    const shopRow = gilShops.get(shopId)
    const rawName = shopRow ? decodeSeString(shopRow[0]) : ''
    if (rawName.startsWith('测试')) continue
    const shopName =
      rawName || shopFallbackNames.get(shopId) || '金币道具商店'
    const npcIds = shopToNpcs.get(shopId) || []

    for (const sub of subrows) {
      const itemId = Number(sub.data[0])
      if (itemId <= 0) continue
      const itemRow = itemsCn.get(itemId)
      if (!itemRow) continue
      const priceMid = Number(itemRow[25])
      if (priceMid <= 0) continue

      addShopEntry(itemId, {
        shopId,
        shopType: 'gil',
        shopTypeLabel: '金币商店',
        shopName,
        receiveAmount: 1,
        receiveHq: false,
        costs: [
          {
            itemId: 1,
            nameCn: '金币',
            iconId: 65002,
            amount: priceMid,
          },
        ],
        npcIds,
      })
    }
  }

  // 6. 解析 SpecialShop (特殊货币/兑换商店)
  for (const [shopId, row] of specialShops.entries()) {
    const rawName = decodeSeString(row[0])
    if (rawName.startsWith('测试')) continue
    const shopName =
      rawName || shopFallbackNames.get(shopId) || '特殊兑换商店'
    const useCurrencyType = Number(row[2041])
    const npcIds = shopToNpcs.get(shopId) || []

    // 每个 SpecialShop 包含 60 个交易槽位
    for (let slot = 0; slot < 60; slot++) {
      // 收集该槽位所需的最多 3 种兑换消耗物
      const costs: RawShopCost[] = []
      const costItemBlocks = [481, 721, 961]
      const costCountBlocks = [541, 781, 1021]
      const collectabilityBlocks = [661, 901, 1141]

      for (let c = 0; c < 3; c++) {
        const rawCostId = Number(row[costItemBlocks[c] + slot])
        const costAmount = Number(row[costCountBlocks[c] + slot])
        if (rawCostId <= 0 || costAmount <= 0) continue
        const resolvedCostId = resolveSpecialCurrencyId(
          rawCostId,
          useCurrencyType,
          tomestoneByIndex,
        )
        const collectability = Number(row[collectabilityBlocks[c] + slot]) || 0
        costs.push({
          itemId: resolvedCostId,
          amount: costAmount,
          collectability: collectability > 0 ? collectability : undefined,
        })
      }

      if (costs.length === 0) continue

      // 每个交易槽位可产出最多 2 种道具 (如骑士剑+盾套装)
      const receiveItemBlocks = [1, 241]
      const receiveCountBlocks = [61, 301]
      const receiveHqBlocks = [181, 421]

      for (let r = 0; r < 2; r++) {
        const receiveItemId = Number(row[receiveItemBlocks[r] + slot])
        if (receiveItemId <= 0) continue
        const receiveAmount = Number(row[receiveCountBlocks[r] + slot]) || 1
        const receiveHq = Boolean(row[receiveHqBlocks[r] + slot])

        addShopEntry(receiveItemId, {
          shopId,
          shopType: 'special',
          shopTypeLabel: '特殊兑换',
          shopName,
          receiveAmount,
          receiveHq,
          costs,
          npcIds,
        })
      }
    }
  }

  // 7. 解析 GCScripShopItem (大国防联军军票商店)
  for (const [parentId, subrows] of gcScripShopItems.entries()) {
    if (parentId <= 0) continue
    let gcName = '大国防联军军票商店'
    let sealItemId = 20
    if (parentId >= 1 && parentId <= 12) {
      gcName = '黑涡团军票商店'
      sealItemId = 20
    } else if (parentId >= 13 && parentId <= 24) {
      gcName = '双蛇党军票商店'
      sealItemId = 21
    } else if (parentId >= 25) {
      gcName = '恒辉队军票商店'
      sealItemId = 22
    }

    for (const sub of subrows) {
      const itemId = Number(sub.data[0])
      const costAmount = Number(sub.data[2])
      if (itemId <= 0 || costAmount <= 0) continue
      addShopEntry(itemId, {
        shopId: 1441792 + parentId,
        shopType: 'gc',
        shopTypeLabel: '军票商店',
        shopName: gcName,
        receiveAmount: 1,
        receiveHq: false,
        costs: [{ itemId: sealItemId, amount: costAmount }],
        npcIds: [],
      })
    }
  }

  // 8. 解析 FccShop (部队战绩商店)
  for (const [shopId, row] of fccShops.entries()) {
    const shopName = decodeSeString(row[0]) || '部队战绩交易'
    for (let i = 0; i < 10; i++) {
      const itemId = Number(row[1 + i])
      const costAmount = Number(row[11 + i])
      if (itemId <= 0 || costAmount <= 0) continue
      addShopEntry(itemId, {
        shopId,
        shopType: 'fcc',
        shopTypeLabel: '部队战绩',
        shopName,
        receiveAmount: 1,
        receiveHq: false,
        costs: [
          {
            itemId: 0,
            nameCn: '部队战绩',
            iconId: 65016,
            amount: costAmount,
          },
        ],
        npcIds: [],
      })
    }
  }

  return {
    shopsByItem,
    npcNames,
    npcLocations,
    totalActiveShops: activeShopIds.size,
  }
}
