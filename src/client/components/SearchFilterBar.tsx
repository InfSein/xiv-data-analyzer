import { RotateCcw } from 'lucide-react'
import type {
  ItemCategoryInfo,
  ItemFilterMode,
  ItemSearchQuery,
  ItemSortMode,
  SystemStatus,
} from '../../shared/types'

interface SearchFilterBarProps {
  status: SystemStatus | null
  query: ItemSearchQuery
  categories: ItemCategoryInfo[]
  onChange: (nextQuery: ItemSearchQuery) => void
  onReset: () => void
}

const FILTER_MODES: Array<{ mode: ItemFilterMode; label: string }> = [
  { mode: 'all', label: '全部' },
  { mode: 'craftable', label: '可制作' },
  { mode: 'gatherable', label: '可采集' },
  { mode: 'purchasable', label: '可商店购买' },
  { mode: 'ingredient', label: '配方素材' },
  { mode: 'equipment', label: '武器装备' },
  { mode: 'consumable', label: '食品药水' },
]

/**
 * 工作台顶部四栏 KPI 指标带与多条件过滤工具栏 (To-B Framed-Sheet 风格)
 */
export function SearchFilterBar({
  status,
  query,
  categories,
  onChange,
  onReset,
}: SearchFilterBarProps) {
  const currentFilter = query.filter || 'all'

  return (
    <div>
      {/* 1. 四栏分割 KPI 统计带 (1px 分割线、无装饰图标圆圈、等宽数字对齐) */}
      {status && (
        <div className="kpi-strip">
          <div className="kpi-cell">
            <div className="kpi-label">客户端有效道具总数</div>
            <div className="kpi-value">
              {status.stats.totalItems.toLocaleString()}
            </div>
            <div className="kpi-meta">
              中/英/日三语索引 · 解析耗时 {status.stats.loadTimeMs}ms
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">能工巧匠制作配方</div>
            <div className="kpi-value">
              {status.stats.totalRecipes.toLocaleString()}
            </div>
            <div className="kpi-meta">
              涵盖 {status.stats.craftableItems.toLocaleString()} 种可制作成品
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">大地使者可采集与垂钓</div>
            <div className="kpi-value">
              {status.stats.gatherableItems.toLocaleString()}
            </div>
            <div className="kpi-meta">
              {status.stats.totalGatheringPoints.toLocaleString()} 采集点 ·{' '}
              {status.stats.totalFishingSpots.toLocaleString()} 钓场
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">NPC 商店可购买道具</div>
            <div className="kpi-value text-[#1b6c80]">
              {status.stats.purchasableItems.toLocaleString()}
            </div>
            <div className="kpi-meta">
              覆盖 {status.stats.totalShops.toLocaleString()} 个金币与特殊兑换商店
            </div>
          </div>
        </div>
      )}

      {/* 2. 紧凑型筛选控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e8eaec] bg-[#f9fbfc] px-4 py-2 text-[12px]">
        {/* 左侧快捷过滤分段按钮 */}
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_MODES.map((tab) => {
            const active = currentFilter === tab.mode
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() =>
                  onChange({
                    ...query,
                    filter: tab.mode,
                    craftTypeId:
                      tab.mode === 'craftable' ? query.craftTypeId : undefined,
                    page: 1,
                  })
                }
                className={`h-7 rounded-[5px] px-2.5 text-[12px] font-medium transition-colors ${
                  active
                    ? 'bg-[#1d1f20] text-white'
                    : 'text-[#5d5f60] hover:bg-[#ebedee] hover:text-[#131416]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 右侧精细筛选控件 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 道具分类下拉 */}
          <select
            value={query.categoryId || 0}
            onChange={(e) =>
              onChange({
                ...query,
                categoryId: Number(e.target.value) || undefined,
                page: 1,
              })
            }
            className="h-7 rounded-[5px] border border-[#cdced1] bg-white px-2 text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
          >
            <option value={0}>全部分类 ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>

          {/* 品级区间 */}
          <div className="flex items-center gap-1 text-[#5d5f60]">
            <span>品级:</span>
            <input
              type="number"
              min={1}
              max={999}
              placeholder="最低"
              value={query.minIlvl || ''}
              onChange={(e) =>
                onChange({
                  ...query,
                  minIlvl: e.target.value ? Number(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="h-7 w-14 rounded-[5px] border border-[#cdced1] bg-white px-1.5 text-right text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
            />
            <span>–</span>
            <input
              type="number"
              min={1}
              max={999}
              placeholder="最高"
              value={query.maxIlvl || ''}
              onChange={(e) =>
                onChange({
                  ...query,
                  maxIlvl: e.target.value ? Number(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="h-7 w-14 rounded-[5px] border border-[#cdced1] bg-white px-1.5 text-right text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
            />
          </div>

          {/* 仅可交易 */}
          <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#131416] select-none hover:bg-[#f4f6f8]">
            <input
              type="checkbox"
              checked={Boolean(query.tradableOnly)}
              onChange={(e) =>
                onChange({
                  ...query,
                  tradableOnly: e.target.checked || undefined,
                  page: 1,
                })
              }
              className="accent-[#1b6c80]"
            />
            <span>仅可交易</span>
          </label>

          {/* 排序 */}
          <select
            value={query.sort || 'id_asc'}
            onChange={(e) =>
              onChange({
                ...query,
                sort: e.target.value as ItemSortMode,
                page: 1,
              })
            }
            className="h-7 rounded-[5px] border border-[#cdced1] bg-white px-2 text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none"
          >
            <option value="id_asc">ID 升序</option>
            <option value="id_desc">ID 降序</option>
            <option value="ilvl_desc">品级 从高到低</option>
            <option value="ilvl_asc">品级 从低到高</option>
            <option value="level_desc">装备等级 从高到低</option>
          </select>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#5d5f60] transition-colors hover:bg-[#ebedee] hover:text-[#131416]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>重置</span>
          </button>
        </div>
      </div>
    </div>
  )
}
