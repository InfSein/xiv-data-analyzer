import {
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type {
  AchievementEntry,
  AchievementSearchQuery,
  SystemStatus,
} from '../../shared/types'
import { fetchAchievements, getIconUrl } from '../api'

interface AchievementViewProps {
  status: SystemStatus | null
  onInspectItem: (itemId: number) => void
}

const FILTER_TABS: Array<{
  mode: 'all' | 'with_title' | 'with_item'
  label: string
}> = [
  { mode: 'all', label: '全部成就' },
  { mode: 'with_title', label: '附带奖励称号' },
  { mode: 'with_item', label: '附带奖励道具' },
]

/**
 * 成就与称号数据解析与检索视图 (To-B Framed-Sheet 风格)
 */
export function AchievementView({
  status,
  onInspectItem,
}: AchievementViewProps) {
  const [query, setQuery] = useState<AchievementSearchQuery>({
    filter: 'all',
    page: 1,
    pageSize: 30,
  })
  const [items, setItems] = useState<AchievementEntry[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pageInput, setPageInput] = useState('1')

  const currentPage = query.page || 1

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const loadData = useCallback(() => {
    setLoading(true)
    fetchAchievements(query)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 120)
    return () => clearTimeout(timer)
  }, [loadData])

  const commitPageInput = () => {
    const parsed = parseInt(pageInput.trim(), 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage))
      return
    }
    const target = Math.max(1, Math.min(totalPages, parsed))
    setPageInput(String(target))
    if (target !== currentPage) {
      setQuery((prev) => ({ ...prev, page: target }))
    }
  }

  const kinds = status?.achievementKinds || []
  const currentFilter = query.filter || 'all'

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* 1. 顶部四栏分割 KPI 统计带 */}
      {status && (
        <div className="kpi-strip">
          <div className="kpi-cell">
            <div className="kpi-label">客户端有效成就总数</div>
            <div className="kpi-value">
              {status.stats.totalAchievements.toLocaleString()}
            </div>
            <div className="kpi-meta">
              涵盖 {kinds.length} 大成就类别 · 中/英/日三语对照
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">解析角色称号总数</div>
            <div className="kpi-value text-[#1b6c80]">
              {status.stats.totalTitles.toLocaleString()}
            </div>
            <div className="kpi-meta">
              区分男女角色称谓及前缀/后缀显示位置
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">当前筛选匹配成就</div>
            <div className="kpi-value">{total.toLocaleString()}</div>
            <div className="kpi-meta">
              第 {currentPage} / {totalPages} 页
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">数据表映射</div>
            <div className="kpi-value text-[18px] font-medium">
              Achievement · Title
            </div>
            <div className="kpi-meta">
              基于 @ffcafe/elpis-sqpack 实时只读解析
            </div>
          </div>
        </div>
      )}

      {/* 2. 筛选与搜索工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaec] bg-[#f9fbfc] px-5 py-2.5 text-[12px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const active = currentFilter === tab.mode
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() =>
                  setQuery((prev) => ({ ...prev, filter: tab.mode, page: 1 }))
                }
                className={`h-7 rounded-[6px] px-3 text-[12px] font-medium transition-colors ${
                  active
                    ? 'bg-[#1d1f20] text-white'
                    : 'text-[#5d5f60] hover:bg-[#ebedee] hover:text-[#131416]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}

          <select
            value={query.kindId || 0}
            onChange={(e) =>
              setQuery((prev) => ({
                ...prev,
                kindId: Number(e.target.value) || undefined,
                page: 1,
              }))
            }
            className="ml-1 h-7 rounded-[5px] border border-[#cdced1] bg-white px-2 text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
          >
            <option value={0}>全部成就大类 ({kinds.length})</option>
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              type="text"
              value={query.q || ''}
              onChange={(e) =>
                setQuery((prev) => ({ ...prev, q: e.target.value, page: 1 }))
              }
              placeholder="检索成就名、达成条件、称号名或 ID..."
              className="h-7 w-full rounded-[6px] border border-[#cdced1] bg-white pr-3 pl-8 text-[12px] text-[#131416] placeholder-[#6b6b6b] focus:border-[#1b6c80] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setQuery({ filter: 'all', kindId: undefined, q: '', page: 1 })
            }
            className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#5d5f60] transition-colors hover:bg-[#ebedee] hover:text-[#131416]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>重置</span>
          </button>
        </div>
      </div>

      {/* 3. 成就与称号数据表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-[13px] text-[#5d5f60]">
            正在读取本地 SqPack 成就与称号数据...
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-1 text-[13px] text-[#5d5f60]">
            <Award className="h-6 w-6 text-[#6b6b6b]" />
            <p>未找到符合筛选条件的成就或称号</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[#e8eaec] bg-[#f9fbfc] text-[12px] font-medium text-[#5d5f60]">
              <tr>
                <th className="w-20 px-4 py-2.5 text-right font-medium" data-num>
                  ID
                </th>
                <th className="w-72 px-4 py-2.5 font-medium">成就名称与多语言</th>
                <th className="w-36 px-3 py-2.5 font-medium">所属分类</th>
                <th className="w-20 px-3 py-2.5 text-right font-medium" data-num>
                  点数
                </th>
                <th className="px-4 py-2.5 font-medium">达成条件说明</th>
                <th className="w-60 px-4 py-2.5 font-medium">奖励称号</th>
                <th className="w-56 px-4 py-2.5 font-medium">奖励道具</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f1f2]">
              {items.map((ach) => {
                const hasDiffGenderTitle =
                  ach.titleMasculineCn &&
                  ach.titleFeminineCn &&
                  ach.titleMasculineCn !== ach.titleFeminineCn

                return (
                  <tr
                    key={ach.id}
                    className="transition-colors hover:bg-[#f9fbfc]"
                  >
                    <td
                      className="px-4 py-2.5 text-right text-[12px] text-[#5d5f60] num"
                      data-num
                    >
                      #{ach.id}
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getIconUrl(ach.iconId)}
                          alt={ach.nameCn}
                          loading="lazy"
                          className="h-8 w-8 shrink-0 rounded-[5px] border border-[#e8eaec] bg-[#f4f6f8]"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[#131416]">
                            {ach.nameCn}
                          </div>
                          <div className="truncate text-[11px] text-[#5d5f60]">
                            {ach.nameEn || ach.nameJa || '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="pill pill-neutral">
                        {ach.kindName} · {ach.categoryName}
                      </span>
                    </td>

                    <td
                      className="px-3 py-2.5 text-right font-semibold text-[#131416] num"
                      data-num
                    >
                      {ach.points}
                    </td>

                    <td className="px-4 py-2.5 text-[12px] text-[#131416]">
                      {ach.descriptionCn || '-'}
                    </td>

                    <td className="px-4 py-2.5">
                      {ach.titleId > 0 && ach.titleMasculineCn ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="pill pill-warning">
                              《
                              {hasDiffGenderTitle
                                ? `${ach.titleMasculineCn} / ${ach.titleFeminineCn}`
                                : ach.titleMasculineCn}
                              》
                            </span>
                            <span className="text-[11px] text-[#6b6b6b]">
                              {ach.titleIsPrefix ? '前缀' : '后缀'}
                            </span>
                          </div>
                          {(ach.titleNameEn || ach.titleNameJa) && (
                            <div className="mt-0.5 truncate text-[11px] text-[#5d5f60]">
                              {ach.titleNameEn}
                              {ach.titleNameJa ? ` · ${ach.titleNameJa}` : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#6b6b6b]">-</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {ach.rewardItemId > 0 && ach.rewardItemNameCn ? (
                        <button
                          type="button"
                          onClick={() => onInspectItem(ach.rewardItemId)}
                          className="inline-flex items-center gap-2 rounded-[5px] border border-[#e8eaec] bg-[#f9fbfc] px-2.5 py-1 text-left text-[12px] text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80]"
                        >
                          <img
                            src={getIconUrl(ach.rewardItemIconId)}
                            alt={ach.rewardItemNameCn}
                            className="h-5 w-5 rounded-[3px]"
                          />
                          <span className="truncate font-medium">
                            {ach.rewardItemNameCn}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#6b6b6b]">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. 底部分页控制栏（支持跳至首页/末页与自定义页码输入） */}
      <div className="flex items-center justify-between border-t border-[#e8eaec] bg-[#f9fbfc] px-5 py-2.5 text-[12px]">
        <span className="text-[#5d5f60] num">
          共 <strong className="text-[#131416]">{total.toLocaleString()}</strong>{' '}
          项成就记录
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="跳到第一页"
            disabled={currentPage <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: 1 }))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#cdced1] bg-white text-[#131416] hover:bg-[#f4f6f8] disabled:opacity-40"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() =>
              setQuery((prev) => ({
                ...prev,
                page: Math.max(1, (prev.page || 1) - 1),
              }))
            }
            className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#131416] hover:bg-[#f4f6f8] disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            上一页
          </button>

          <div className="mx-1 flex items-center gap-1 text-[11px] text-[#5d5f60] num">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) =>
                setPageInput(e.target.value.replace(/[^\d]/g, ''))
              }
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                  commitPageInput()
                }
              }}
              className="h-7 w-14 rounded-[5px] border border-[#cdced1] bg-white px-1.5 text-center text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
            />
            <span>/ {totalPages}</span>
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() =>
              setQuery((prev) => ({
                ...prev,
                page: Math.min(totalPages, (prev.page || 1) + 1),
              }))
            }
            className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#131416] hover:bg-[#f4f6f8] disabled:opacity-40"
          >
            下一页
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="跳到最后一页"
            disabled={currentPage >= totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: totalPages }))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#cdced1] bg-white text-[#131416] hover:bg-[#f4f6f8] disabled:opacity-40"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
