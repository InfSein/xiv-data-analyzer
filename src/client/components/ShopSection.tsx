import { MapPin, Store } from 'lucide-react'
import type { ShopPurchaseSource } from '../../shared/types'
import { getIconUrl } from '../api'
import type { MapMarkerData } from './MapModal'

interface ShopSectionProps {
  itemName: string
  shops: ShopPurchaseSource[]
  onSelectItem: (itemId: number) => void
  onOpenMap: (marker: MapMarkerData) => void
}

function getShopTypePillClass(shopType: ShopPurchaseSource['shopType']): string {
  switch (shopType) {
    case 'gil':
      return 'pill pill-neutral'
    case 'special':
      return 'pill pill-accent'
    case 'gc':
      return 'pill pill-warning'
    case 'fcc':
      return 'pill pill-positive'
    default:
      return 'pill pill-neutral'
  }
}

/**
 * NPC 商店购买与特殊货币兑换途径面板 (To-B Framed-Sheet 风格)
 */
export function ShopSection({
  itemName,
  shops,
  onSelectItem,
  onOpenMap,
}: ShopSectionProps) {
  if (!shops || shops.length === 0) {
    return null
  }

  return (
    <section className="rounded-[8px] border border-[#e8eaec] bg-white">
      {/* 面板标题栏 */}
      <div className="flex items-center justify-between border-b border-[#e8eaec] px-4 py-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-[#1b6c80]" />
          <h3 className="text-[14px] font-semibold text-[#131416]">
            NPC 商店购买与兑换途径
          </h3>
          <span className="pill pill-accent num">{shops.length} 项渠道</span>
        </div>
        <span className="text-[12px] text-[#5d5f60]">
          支持点击兑换所需道具跳转或查看售卖 NPC 地图坐标
        </span>
      </div>

      {/* 商店兑换明细表格 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e8eaec] bg-[#f9fbfc] text-[12px] font-medium text-[#5d5f60]">
              <th className="px-4 py-2.5 font-medium">商店名称 / 类型</th>
              <th className="px-3 py-2.5 text-right font-medium" data-num>
                产出数量
              </th>
              <th className="px-4 py-2.5 font-medium">所需货币 / 交换道具</th>
              <th className="px-4 py-2.5 font-medium">售卖 NPC 与位置坐标</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f1f2]">
            {shops.map((shop, idx) => (
              <tr
                key={`${shop.shopId}-${idx}`}
                className="align-top transition-colors hover:bg-[#f9fbfc]"
              >
                {/* 1. 商店名称与分类标签 */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={getShopTypePillClass(shop.shopType)}>
                      {shop.shopTypeLabel}
                    </span>
                    <span className="font-medium text-[#131416]">
                      {shop.shopName}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#6b6b6b] num">
                    Shop #{shop.shopId}
                  </div>
                </td>

                {/* 2. 单次兑换数量 */}
                <td className="px-3 py-3 text-right text-[#131416] num">
                  ×{shop.receiveAmount}
                  {shop.receiveHq && (
                    <span className="ml-1 pill pill-warning">HQ</span>
                  )}
                </td>

                {/* 3. 消耗货币或兑换物 */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {shop.costs.map((cost, cIdx) => {
                      const canJump = cost.itemId > 1 && cost.itemId < 100000
                      return (
                        <button
                          key={`${cost.itemId}-${cIdx}`}
                          type="button"
                          disabled={!canJump}
                          onClick={() => canJump && onSelectItem(cost.itemId)}
                          className={`inline-flex items-center gap-2 rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] px-2.5 py-1 text-[12px] ${
                            canJump
                              ? 'cursor-pointer hover:border-[#cdced1] hover:bg-[#ebedee]'
                              : 'cursor-default'
                          }`}
                        >
                          {cost.iconId > 0 && (
                            <img
                              src={getIconUrl(cost.iconId)}
                              alt={cost.nameCn}
                              className="h-4 w-4 shrink-0 rounded-[3px]"
                            />
                          )}
                          <span className="text-[#131416]">{cost.nameCn}</span>
                          <span className="font-semibold text-[#1b6c80] num">
                            ×{cost.amount.toLocaleString()}
                          </span>
                          {cost.collectability && (
                            <span className="text-[11px] text-[#5d5f60] num">
                              (收藏价值 {cost.collectability}+)
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </td>

                {/* 4. 关联 NPC 列表与坐标 */}
                <td className="px-4 py-3">
                  {shop.npcs.length === 0 ? (
                    <span className="text-[12px] text-[#6b6b6b]">
                      通用柜台 / 住宅区或大国防联军军需官兑换
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {shop.npcs.slice(0, 6).map((npc) => (
                        <div
                          key={npc.npcId}
                          className="inline-flex items-center gap-2 rounded-[6px] border border-[#e8eaec] bg-white px-2.5 py-1 text-[12px]"
                        >
                          <div>
                            <span className="font-medium text-[#131416]">
                              {npc.npcName}
                            </span>
                            {npc.npcTitle && (
                              <span className="ml-1 text-[11px] text-[#5d5f60]">
                                &lt;{npc.npcTitle}&gt;
                              </span>
                            )}
                            {npc.zoneName && (
                              <span className="ml-1.5 text-[11px] text-[#5d5f60]">
                                · {npc.zoneName}
                                {npc.placeName && npc.placeName !== npc.zoneName
                                  ? ` (${npc.placeName})`
                                  : ''}
                              </span>
                            )}
                          </div>

                          {npc.mapPath && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenMap({
                                  title: `${npc.npcName}${npc.npcTitle ? ` <${npc.npcTitle}>` : ''}`,
                                  subtitle: `${shop.shopName} (售卖: ${itemName})`,
                                  regionName: npc.regionName,
                                  zoneName: npc.zoneName,
                                  placeName: npc.placeName || npc.zoneName,
                                  mapPath: npc.mapPath,
                                  coordX: npc.coordX,
                                  coordY: npc.coordY,
                                  normX: npc.normX,
                                  normY: npc.normY,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-[4px] border border-[#cdced1] bg-[#f4f6f8] px-1.5 py-0.5 text-[11px] font-medium text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80] num"
                            >
                              <MapPin className="h-3 w-3 text-[#1b6c80]" />
                              <span>
                                X:{npc.coordX}, Y:{npc.coordY}
                              </span>
                            </button>
                          )}
                        </div>
                      ))}
                      {shop.npcs.length > 6 && (
                        <span className="self-center text-[11px] text-[#6b6b6b] num">
                          等共 {shop.npcs.length} 名商人
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
