import {
  Award,
  Check,
  Copy,
  FlaskConical,
  Info,
  Shield,
  Sliders,
} from 'lucide-react'
import { useState } from 'react'
import type { ItemDetail as ItemDetailType } from '../../shared/types'
import { getIconUrl } from '../api'
import { GatheringSection } from './GatheringSection'
import type { MapMarkerData } from './MapModal'
import { RecipeSection, UsedInRecipeSection } from './RecipeSection'
import { ShopSection } from './ShopSection'

interface ItemDetailProps {
  item: ItemDetailType | null
  loading: boolean
  onSelectItem: (itemId: number) => void
  onOpenMap: (marker: MapMarkerData) => void
}

/**
 * 右侧道具完整详情工作区：包含基础规格、装备与药效参数、NPC商店购买、制作配方树、采集点分布与下游配方用途 (To-B Framed-Sheet 风格)
 */
export function ItemDetail({
  item,
  loading,
  onSelectItem,
  onOpenMap,
}: ItemDetailProps) {
  const [showHq, setShowHq] = useState(true)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-[8px] border border-[#e8eaec] bg-white text-[13px] text-[#5d5f60]">
        正在读取本地 SqPack 道具详情数据...
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-[8px] border border-[#e8eaec] bg-white text-[13px] text-[#5d5f60]">
        <Info className="h-6 w-6 text-[#6b6b6b]" />
        <p>请从左侧列表选择任意道具查看完整解析数据</p>
      </div>
    )
  }

  const isHqActive = item.canBeHq && showHq
  const hasRecipes = item.recipes.length > 0
  const hasUsedInRecipes = item.usedInRecipes.length > 0
  const hasGathering =
    item.gathering.nodes.length > 0 ||
    item.gathering.fishingSpots.length > 0 ||
    item.gathering.spearfishing.length > 0
  const hasShops = item.shops && item.shops.length > 0
  const hasAchievementRewards =
    item.rewardedFromAchievements && item.rewardedFromAchievements.length > 0

  const handleCopyName = () => {
    navigator.clipboard?.writeText(item.nameCn)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const showEquipmentRepair =
    item.isEquipment && Boolean(item.repairClassJobName)

  return (
    <div className="space-y-4">
      {/* 1. 道具核心规格面板 */}
      <section className="rounded-[8px] border border-[#e8eaec] bg-white">
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* 图标与主标题区 */}
            <div className="flex items-start gap-3.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-[#e8eaec] bg-[#f4f6f8] p-1">
                <img
                  src={getIconUrl(item.iconId, isHqActive)}
                  alt={item.nameCn}
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[20px] font-semibold tracking-tight text-[#131416]">
                    {item.nameCn}
                  </h2>
                  {isHqActive && (
                    <span className="pill pill-warning">HQ 高品质</span>
                  )}
                  <span className="rounded-[5px] border border-[#e8eaec] bg-[#f4f6f8] px-2 py-0.5 text-[11px] text-[#5d5f60] num">
                    ID #{item.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyName}
                    className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2 text-[11px] text-[#5d5f60] transition-colors hover:bg-[#f4f6f8] hover:text-[#131416]"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-3 w-3 text-[#1e7b4f]" />
                        <span className="text-[#1e7b4f]">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>复制名称</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 多语言对照 */}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[#5d5f60]">
                  <span>
                    EN:{' '}
                    <strong className="font-normal text-[#131416]">
                      {item.nameEn || '-'}
                    </strong>
                  </span>
                  <span className="text-[#cdced1]">|</span>
                  <span>
                    JA:{' '}
                    <strong className="font-normal text-[#131416]">
                      {item.nameJa || '-'}
                    </strong>
                  </span>
                </div>

                {/* 分类、品级、装备条件与交易/出售/市场上架三类标识 */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="pill pill-neutral">
                    {item.categoryIconId > 0 && (
                      <img
                        src={getIconUrl(item.categoryIconId)}
                        alt={item.categoryName}
                        className="h-3 w-3"
                      />
                    )}
                    {item.categoryName}
                  </span>
                  <span className="pill pill-accent num">
                    品级 iLvl {item.itemLevel}
                  </span>
                  {item.equipLevel > 0 && (
                    <span className="pill pill-neutral num">
                      装备等级 Lv.{item.equipLevel}
                    </span>
                  )}
                  {item.equipSlotName && (
                    <span className="pill pill-neutral">
                      部位: {item.equipSlotName}
                    </span>
                  )}
                  {item.classJobCategoryName && (
                    <span className="pill pill-neutral">
                      职业: {item.classJobCategoryName}
                    </span>
                  )}

                  {/* 区分：①不可交易 ②不可出售 ③不可在市场出售 */}
                  <span
                    className={
                      item.isTradable
                        ? 'pill pill-positive'
                        : 'pill pill-negative'
                    }
                  >
                    {item.isTradable ? '可玩家间交易' : '不可交易'}
                  </span>
                  <span
                    className={
                      item.isSellable
                        ? 'pill pill-neutral'
                        : 'pill pill-negative'
                    }
                  >
                    {item.isSellable ? '可向商店出售' : '不可出售'}
                  </span>
                  <span
                    className={
                      item.isMarketable
                        ? 'pill pill-positive'
                        : 'pill pill-warning'
                    }
                  >
                    {item.isMarketable ? '可在市场出售' : '不可在市场出售'}
                  </span>

                  {item.isUnique && (
                    <span className="pill pill-warning">独占</span>
                  )}
                  {item.isCollectable && (
                    <span className="pill pill-accent">收藏品</span>
                  )}
                  {item.canAetherialReduce && (
                    <span className="pill pill-neutral">可灵砂精选</span>
                  )}
                </div>
              </div>
            </div>

            {/* NQ / HQ 分段切换器 */}
            {item.canBeHq && (
              <div className="inline-flex rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] p-0.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setShowHq(false)}
                  className={`h-7 rounded-[5px] px-3 font-medium transition-colors ${
                    !showHq
                      ? 'bg-[#1d1f20] text-white'
                      : 'text-[#5d5f60] hover:text-[#131416]'
                  }`}
                >
                  普通品质 (NQ)
                </button>
                <button
                  type="button"
                  onClick={() => setShowHq(true)}
                  className={`h-7 rounded-[5px] px-3 font-medium transition-colors ${
                    showHq
                      ? 'bg-[#1d1f20] text-white'
                      : 'text-[#5d5f60] hover:text-[#131416]'
                  }`}
                >
                  高品质 (HQ)
                </button>
              </div>
            )}
          </div>

          {/* 游戏内原始说明文本 */}
          {item.descriptionCn && (
            <div className="mt-3.5 rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] px-3.5 py-2.5 text-[12px] leading-relaxed whitespace-pre-line text-[#131416]">
              {item.descriptionCn}
            </div>
          )}
        </div>

        {/* 底部三栏核心经济与叠加上限分割条（已移除商店基准售价，非装备物品不展示装备修理要求） */}
        <div className="grid grid-cols-1 border-t border-[#e8eaec] bg-[#f9fbfc] sm:grid-cols-3">
          <div className="border-b border-[#f0f1f2] px-4 py-2.5 sm:border-r sm:border-b-0">
            <div className="text-[11px] text-[#5d5f60]">单格叠加上限</div>
            <div className="mt-0.5 text-[14px] font-semibold text-[#131416] num">
              {item.stackSize.toLocaleString()} 个
            </div>
          </div>

          <div className="border-b border-[#f0f1f2] px-4 py-2.5 sm:border-r sm:border-b-0">
            <div className="text-[11px] text-[#5d5f60]">NPC 回收价格</div>
            <div className="mt-0.5 text-[14px] font-semibold text-[#131416] num">
              {item.isSellable
                ? `${item.priceLow.toLocaleString()} 金币`
                : '不可出售'}
            </div>
          </div>

          <div className="px-4 py-2.5">
            <div className="text-[11px] text-[#5d5f60]">
              {showEquipmentRepair ? '装备修理要求' : '可用获取途径'}
            </div>
            <div className="mt-0.5 text-[13px] font-medium text-[#131416]">
              {showEquipmentRepair
                ? `${item.repairClassJobName}${item.repairItemName ? ` (${item.repairItemName})` : ''}`
                : [
                    item.isGilShop ? '金币商店' : '',
                    item.isSpecialShop ? '特殊兑换' : '',
                    item.isCraftable ? '配方制作' : '',
                    item.isGatherable ? '野外采集/垂钓' : '',
                    hasAchievementRewards ? '成就奖励' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '特殊掉落 / 任务获取'}
            </div>
          </div>
        </div>
      </section>

      {/* 2. 武器/防具/饰品性能参数（含物理/魔法基本性能分离、物理自动攻击、HQ 增益计算） */}
      {item.equipmentStats && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#1b6c80]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                装备性能与副属性词条
              </h3>
            </div>
            {item.equipmentStats.materiaSlotCount > 0 && (
              <div className="flex items-center gap-2 text-[12px] text-[#5d5f60] num">
                <span>
                  魔晶石镶嵌孔: {item.equipmentStats.materiaSlotCount} 孔
                </span>
                <span className="pill pill-neutral">
                  {item.equipmentStats.isAdvancedMeldingPermitted
                    ? '支持禁忌镶嵌'
                    : '不可禁断'}
                </span>
              </div>
            )}
          </div>

          <div className="p-4">
            {/* 主性能指标 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {item.equipmentStats.damagePhys > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">物理基本性能</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {isHqActive
                      ? item.equipmentStats.damagePhysHq
                      : item.equipmentStats.damagePhys}
                    {isHqActive &&
                      item.equipmentStats.damagePhysHq >
                        item.equipmentStats.damagePhys && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.damagePhys})
                        </span>
                      )}
                  </div>
                </div>
              )}

              {item.equipmentStats.damageMag > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">魔法基本性能</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#1b6c80] num">
                    {isHqActive
                      ? item.equipmentStats.damageMagHq
                      : item.equipmentStats.damageMag}
                    {isHqActive &&
                      item.equipmentStats.damageMagHq >
                        item.equipmentStats.damageMag && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.damageMag})
                        </span>
                      )}
                  </div>
                </div>
              )}

              {item.equipmentStats.autoAttack > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">物理自动攻击</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {(isHqActive
                      ? item.equipmentStats.autoAttackHq
                      : item.equipmentStats.autoAttack
                    ).toFixed(2)}
                    {isHqActive &&
                      item.equipmentStats.autoAttackHq >
                        item.equipmentStats.autoAttack && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.autoAttack.toFixed(2)})
                        </span>
                      )}
                  </div>
                </div>
              )}

              {item.equipmentStats.delaySec > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">攻击间隔 (秒)</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {item.equipmentStats.delaySec.toFixed(2)}s
                  </div>
                </div>
              )}

              {item.equipmentStats.blockRate > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">格挡发动力</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {isHqActive
                      ? item.equipmentStats.blockRateHq
                      : item.equipmentStats.blockRate}
                    {isHqActive &&
                      item.equipmentStats.blockRateHq >
                        item.equipmentStats.blockRate && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.blockRate})
                        </span>
                      )}
                  </div>
                </div>
              )}

              {item.equipmentStats.block > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">格挡性能</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {isHqActive
                      ? item.equipmentStats.blockHq
                      : item.equipmentStats.block}
                    {isHqActive &&
                      item.equipmentStats.blockHq >
                        item.equipmentStats.block && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.block})
                        </span>
                      )}
                  </div>
                </div>
              )}

              {item.equipmentStats.defensePhys > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">物理防御力</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {isHqActive
                      ? item.equipmentStats.defensePhysHq
                      : item.equipmentStats.defensePhys}
                    {isHqActive &&
                      item.equipmentStats.defensePhysHq >
                        item.equipmentStats.defensePhys && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.defensePhys})
                        </span>
                      )}
                  </div>
                </div>
              )}

              {item.equipmentStats.defenseMag > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
                  <div className="text-[11px] text-[#5d5f60]">魔法防御力</div>
                  <div className="mt-0.5 text-[18px] font-semibold text-[#131416] num">
                    {isHqActive
                      ? item.equipmentStats.defenseMagHq
                      : item.equipmentStats.defenseMag}
                    {isHqActive &&
                      item.equipmentStats.defenseMagHq >
                        item.equipmentStats.defenseMag && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#5d5f60]">
                          (NQ {item.equipmentStats.defenseMag})
                        </span>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* 副属性词条 */}
            {item.equipmentStats.bonuses.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {item.equipmentStats.bonuses.map((b) => {
                  const val = isHqActive ? b.valueHq : b.valueNq
                  return (
                    <div
                      key={b.paramId}
                      className="flex items-center justify-between rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] px-3 py-2 text-[12px]"
                    >
                      <span className="font-medium text-[#131416]">
                        {b.name}
                      </span>
                      <span className="font-semibold text-[#1b6c80] num">
                        +{val}
                        {isHqActive && b.valueHq > b.valueNq && (
                          <span className="ml-1 text-[11px] font-normal text-[#6b6b6b]">
                            (NQ +{b.valueNq})
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2.5 装备附加特性面板（精制魔晶石、武具投影、道具分解、染色、部队徽记、投影台、收藏柜） */}
      {item.equipmentAttributes && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex items-center gap-2 border-b border-[#e8eaec] px-4 py-3">
            <Sliders className="h-4 w-4 text-[#1b6c80]" />
            <h3 className="text-[14px] font-semibold text-[#131416]">
              装备附加特性
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">精制魔晶石</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.canExtractMateria
                      ? 'pill pill-positive'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.canExtractMateria ? '可' : '不可'}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">武具投影</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.isProjectable
                      ? 'pill pill-positive'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.isProjectable ? '可' : '不可'}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">道具分解</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.canDesynth
                      ? 'pill pill-positive'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.canDesynth
                    ? `可${item.equipmentAttributes.desynthClassJobName ? ` (${item.equipmentAttributes.desynthClassJobName})` : ''}`
                    : '不可'}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">染色</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.dyeCount > 0
                      ? 'pill pill-positive num'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.dyeCount > 0
                    ? `可 (${item.equipmentAttributes.dyeCount}通道)`
                    : '不可'}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">部队徽记</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.isCrestWorthy
                      ? 'pill pill-positive'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.isCrestWorthy ? '可' : '不可'}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">投影台</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.canStoreInGlamourDresser
                      ? 'pill pill-positive'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.canStoreInGlamourDresser
                    ? '可收纳'
                    : '不可'}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] px-3 py-2">
              <div className="text-[11px] text-[#5d5f60]">收藏柜</div>
              <div className="mt-1">
                <span
                  className={
                    item.equipmentAttributes.canStoreInArmoire
                      ? 'pill pill-positive'
                      : 'pill pill-neutral'
                  }
                >
                  {item.equipmentAttributes.canStoreInArmoire
                    ? '可收纳'
                    : '不可'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. 食品 / 药水使用效果（下方灰字仅显示与上方高亮品质相反的对比数值） */}
      {item.consumableEffect && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#1b6c80]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                {item.consumableEffect.typeName}参数明细
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-[#5d5f60] num">
              <span>
                持续时间:{' '}
                <strong className="font-medium text-[#131416]">
                  {Math.floor(item.consumableEffect.durationSec / 60) > 0
                    ? `${Math.floor(item.consumableEffect.durationSec / 60)}分`
                    : `${item.consumableEffect.durationSec}秒`}
                </strong>
              </span>
              {item.consumableEffect.cooldownSec > 0 && (
                <span>
                  复唱时间:{' '}
                  <strong className="font-medium text-[#131416]">
                    {isHqActive
                      ? item.consumableEffect.cooldownHqSec
                      : item.consumableEffect.cooldownSec}
                    秒
                  </strong>
                </span>
              )}
              {item.consumableEffect.expBonusPercent > 0 && (
                <span className="pill pill-positive">
                  经验值 +{item.consumableEffect.expBonusPercent}%
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {item.consumableEffect.params.map((p) => (
              <div
                key={p.paramId}
                className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#131416]">
                    {p.name}
                  </span>
                  <span className="text-[13px] font-semibold text-[#1b6c80] num">
                    +{isHqActive ? p.valueHq : p.valueNq}
                    {p.isRelative ? '%' : ''}
                    {p.isRelative && (
                      <span className="ml-1 text-[11px] text-[#1e7b4f]">
                        (上限 {isHqActive ? p.maxHq : p.maxNq})
                      </span>
                    )}
                  </span>
                </div>
                {item.canBeHq && (
                  <div className="mt-1.5 text-[11px] text-[#6b6b6b] num">
                    {isHqActive ? (
                      <span>
                        NQ: +{p.valueNq}
                        {p.isRelative ? `% (上限 ${p.maxNq})` : ''}
                      </span>
                    ) : (
                      <span>
                        HQ: +{p.valueHq}
                        {p.isRelative ? `% (上限 ${p.maxHq})` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3.5 成就发放来源（若该道具是某项成就的达成奖励） */}
      {hasAchievementRewards && item.rewardedFromAchievements && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex items-center gap-2 border-b border-[#e8eaec] px-4 py-3">
            <Award className="h-4 w-4 text-[#1b6c80]" />
            <h3 className="text-[14px] font-semibold text-[#131416]">
              关联成就发放途径
            </h3>
          </div>
          <div className="divide-y divide-[#f0f1f2] p-4">
            {item.rewardedFromAchievements.map((ach) => (
              <div
                key={ach.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getIconUrl(ach.iconId)}
                    alt={ach.nameCn}
                    className="h-9 w-9 rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#131416]">
                        {ach.nameCn}
                      </span>
                      <span className="pill pill-neutral num">#{ach.id}</span>
                      <span className="pill pill-accent num">
                        {ach.points} 点
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#5d5f60]">
                      {ach.descriptionCn}
                    </div>
                  </div>
                </div>
                <span className="pill pill-neutral">
                  {ach.kindName} · {ach.categoryName}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. NPC 商店购买与兑换途径 */}
      <ShopSection
        itemName={item.nameCn}
        shops={item.shops}
        onSelectItem={onSelectItem}
        onOpenMap={onOpenMap}
      />

      {/* 5. 能工巧匠制作配方（仅保留子配方工序分解树并含水晶素材） */}
      <RecipeSection
        recipes={item.recipes}
        recipeTrees={item.recipeTrees}
        onSelectItem={onSelectItem}
      />

      {/* 6. 大地使者采集点与捕鱼人垂钓钓场 */}
      <GatheringSection
        itemName={item.nameCn}
        gathering={item.gathering}
        onOpenMap={onOpenMap}
      />

      {/* 7. 作为原料的下游配方用途（已调整至采集点与垂钓钓场下方） */}
      <UsedInRecipeSection
        usedInRecipes={item.usedInRecipes}
        onSelectItem={onSelectItem}
      />

      {/* 若无商店、配方及采集点时的说明 */}
      {!hasShops &&
        !hasRecipes &&
        !hasUsedInRecipes &&
        !hasGathering &&
        !hasAchievementRewards && (
          <div className="rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] p-4 text-center text-[12px] text-[#5d5f60]">
            该道具不通过常规 NPC 商店、能工巧匠配方或大地使者采集获得（通常来源于副本宝箱掉落、主线/支线任务奖励或特殊活动发放）。
          </div>
        )}
    </div>
  )
}
