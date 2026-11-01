import {
  Clock,
  Database,
  GitCompare,
  Hammer,
  Layers,
  Pickaxe,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Utensils,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  ItemFilterMode,
  ItemSearchQuery,
  SystemStatus,
  VersionStatusResponse,
} from '../../shared/types'
import { getIconUrl } from '../api'
import { getCurrentEorzeaTime } from '../utils/eorzea-time'

export type ActiveWorkspaceTab = 'workbench' | 'diff'

interface ChromeNavigationProps {
  activeTab: ActiveWorkspaceTab
  onTabChange: (tab: ActiveWorkspaceTab) => void
  status: SystemStatus | null
  versionStatus: VersionStatusResponse | null
  query: ItemSearchQuery
  onQueryChange: (nextQuery: ItemSearchQuery) => void
  onSelectPresetItem: (itemId: number) => void
}

const SIDEBAR_FILTER_ITEMS: Array<{
  mode: ItemFilterMode
  label: string
  icon: typeof Layers
}> = [
  { mode: 'all', label: '全部道具目录', icon: Layers },
  { mode: 'craftable', label: '能工巧匠配方', icon: Hammer },
  { mode: 'gatherable', label: '大地使者采集', icon: Pickaxe },
  { mode: 'purchasable', label: 'NPC 商店购买', icon: Store },
  { mode: 'ingredient', label: '配方素材原料', icon: Sparkles },
  { mode: 'equipment', label: '武器与战斗装备', icon: Shield },
  { mode: 'consumable', label: '食品与炼金药水', icon: Utensils },
]

const QUICK_PRESETS = [
  { id: 44099, label: '图拉尔菠萝蛋糕' },
  { id: 34577, label: '金毗罗鳄革白狮鹫手套' },
  { id: 36108, label: '5级意力之幻药' },
  { id: 5111, label: '铁矿 (商店/采矿)' },
  { id: 4925, label: '小龙虾 (垂钓)' },
]

/**
 * Framed-Sheet L型外框导航组件：包含左侧 228px 导航栏 (.app-sidebar) 与顶部 48px 检索栏 (.app-topbar)
 */
export function Header({
  activeTab,
  onTabChange,
  status,
  versionStatus,
  query,
  onQueryChange,
  onSelectPresetItem,
}: ChromeNavigationProps) {
  const [etClock, setEtClock] = useState(() => getCurrentEorzeaTime())

  useEffect(() => {
    const timer = setInterval(() => {
      setEtClock(getCurrentEorzeaTime())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const currentFilter = query.filter || 'all'

  return (
    <>
      {/* 左侧 228px 导航栏 */}
      <aside className="app-sidebar">
        {/* 品牌标识 */}
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#cdced1] bg-white text-[#131416]">
            <Database className="h-4 w-4 text-[#1b6c80]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-tight text-[#131416]">
              艾欧泽亚数据工作台
            </div>
            <div className="truncate text-[11px] text-[#6b6b6b]">
              Elpis SqPack Inspector
            </div>
          </div>
        </div>

        {/* 一级工作区切换 */}
        <div className="mt-3 space-y-0.5">
          <div className="px-2.5 py-1 text-[11px] font-medium text-[#6b6b6b]">
            工作区模块
          </div>
          <button
            type="button"
            onClick={() => onTabChange('workbench')}
            className={`flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 text-[13px] transition-colors ${
              activeTab === 'workbench'
                ? 'bg-[#ebedee] font-medium text-[#131416]'
                : 'text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-[#1b6c80]" />
              <span>道具与配方检索</span>
            </span>
            {status && (
              <span className="text-[11px] text-[#6b6b6b] num">
                {status.stats.totalItems.toLocaleString()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('diff')}
            className={`flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 text-[13px] transition-colors ${
              activeTab === 'diff'
                ? 'bg-[#ebedee] font-medium text-[#131416]'
                : 'text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416]'
            }`}
          >
            <span className="flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5 text-[#1b6c80]" />
              <span>版本变更对比</span>
            </span>
            {versionStatus?.hasVersionUpdate ? (
              <span className="pill pill-positive">有新版本</span>
            ) : (
              <span className="pill pill-neutral">Diff</span>
            )}
          </button>
        </div>

        {/* 二级获取途径视图过滤 */}
        <div className="mt-4 space-y-0.5">
          <div className="px-2.5 py-1 text-[11px] font-medium text-[#6b6b6b]">
            数据获取途径视图
          </div>
          {SIDEBAR_FILTER_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              activeTab === 'workbench' &&
              currentFilter === item.mode &&
              query.craftTypeId === undefined
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => {
                  onTabChange('workbench')
                  onQueryChange({
                    ...query,
                    filter: item.mode,
                    craftTypeId: undefined,
                    page: 1,
                  })
                }}
                className={`flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#ebedee] font-medium text-[#131416]'
                    : 'text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-[#5d5f60]" />
                  <span>{item.label}</span>
                </span>
                {status && item.mode === 'purchasable' && (
                  <span className="text-[11px] text-[#6b6b6b] num">
                    {status.stats.purchasableItems.toLocaleString()}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 能工巧匠八大职业快速导航 */}
        {status && status.craftTypes.length > 0 && (
          <div className="mt-4 space-y-0.5">
            <div className="px-2.5 py-1 text-[11px] font-medium text-[#6b6b6b]">
              能工巧匠职业配方
            </div>
            {status.craftTypes.map((ct) => {
              const isSelected =
                activeTab === 'workbench' && query.craftTypeId === ct.id
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => {
                    onTabChange('workbench')
                    onQueryChange({
                      ...query,
                      filter: isSelected ? 'all' : 'craftable',
                      craftTypeId: isSelected ? undefined : ct.id,
                      page: 1,
                    })
                  }}
                  className={`flex h-7 w-full items-center justify-between rounded-[6px] px-2.5 text-[12px] transition-colors ${
                    isSelected
                      ? 'bg-[#ebedee] font-medium text-[#131416]'
                      : 'text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <img
                      src={getIconUrl(ct.iconId)}
                      alt={ct.jobName}
                      className="h-3.5 w-3.5 object-contain"
                    />
                    <span>{ct.jobName}</span>
                  </span>
                  <span className="text-[11px] text-[#6b6b6b] num">
                    {ct.recipeCount.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* 底部客户端版本与实时艾欧泽亚时钟 */}
        <div className="mt-auto pt-4">
          <div className="rounded-[8px] border border-[#e8eaec] bg-white p-2.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#5d5f60]">
                <Clock className="h-3.5 w-3.5 text-[#1b6c80]" />
                <span>艾欧泽亚时间</span>
              </span>
              <span className="text-[13px] font-semibold text-[#131416] num">
                {etClock.formatted}
              </span>
            </div>

            {status && (
              <div className="mt-2 border-t border-[#f0f1f2] pt-2 text-[11px] text-[#5d5f60]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-[#1e7b4f]" />
                    <span>客户端版本</span>
                  </span>
                  <span className="pill pill-positive">只读挂载</span>
                </div>
                <div
                  className="mt-1 truncate text-[#131416] num"
                  title={`国服路径: ${status.cnPath}\n国际服路径: ${status.globalPath}`}
                >
                  v{status.cnVersion}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 顶部 48px 检索与工具栏 */}
      <header className="app-topbar">
        {/* 全局快捷检索框 */}
        <div className="relative w-full max-w-[548px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            type="text"
            value={query.q || ''}
            onChange={(e) => {
              if (activeTab !== 'workbench') onTabChange('workbench')
              onQueryChange({ ...query, q: e.target.value, page: 1 })
            }}
            placeholder="输入中文名、英文名、日文名或道具 ID 快速检索 (如：菠萝蛋糕 / 铁矿 / 44099)..."
            className="h-8 w-full rounded-[6px] border border-[#cdced1] bg-white pr-3 pl-8 text-[13px] text-[#131416] placeholder-[#6b6b6b] transition-colors focus:border-[#1b6c80] focus:outline-none"
          />
        </div>

        {/* 右侧典型样本快捷体验与版本状态 */}
        <div className="hidden items-center gap-1.5 xl:flex">
          <span className="text-[11px] text-[#6b6b6b]">典型样本:</span>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (activeTab !== 'workbench') onTabChange('workbench')
                onSelectPresetItem(preset.id)
              }}
              className="h-6 rounded-[5px] border border-[#e8eaec] bg-white px-2 text-[11px] text-[#5d5f60] transition-colors hover:border-[#cdced1] hover:text-[#131416]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>
    </>
  )
}
