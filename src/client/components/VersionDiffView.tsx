import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type {
  DiffFilterType,
  VersionDiffResponse,
  VersionStatusResponse,
} from '../../shared/types'
import {
  fetchVersionDiff,
  getIconUrl,
  triggerVersionBackup,
} from '../api'

interface VersionDiffViewProps {
  versionStatus: VersionStatusResponse | null
  onVersionStatusChange: (nextStatus: VersionStatusResponse) => void
  onInspectItem: (itemId: number) => void
}

const DIFF_FILTER_TABS: Array<{ mode: DiffFilterType; label: string }> = [
  { mode: 'all', label: '全部变更记录' },
  { mode: 'added', label: '版本新增道具' },
  { mode: 'modified', label: '属性与途径变更' },
  { mode: 'removed', label: '已移除道具' },
]

/**
 * 客户端版本检查、本地快照管理与跨版本 Diff 对比视图 (To-B Framed-Sheet 风格)
 */
export function VersionDiffView({
  versionStatus,
  onVersionStatusChange,
  onInspectItem,
}: VersionDiffViewProps) {
  const [fromVer, setFromVer] = useState<string>('')
  const [toVer, setToVer] = useState<string>('')
  const [filter, setFilter] = useState<DiffFilterType>('all')
  const [searchQ, setSearchQ] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [diffData, setDiffData] = useState<VersionDiffResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [backingUp, setBackingUp] = useState<boolean>(false)

  useEffect(() => {
    if (versionStatus) {
      if (!toVer) setToVer(versionStatus.currentVersion)
      if (!fromVer && versionStatus.previousVersion) {
        setFromVer(versionStatus.previousVersion)
      }
    }
  }, [versionStatus, fromVer, toVer])

  const loadDiff = useCallback(() => {
    setLoading(true)
    fetchVersionDiff({
      from: fromVer || undefined,
      to: toVer || undefined,
      filter,
      q: searchQ || undefined,
      page,
      pageSize: 25,
    })
      .then((res) => {
        setDiffData(res)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [fromVer, toVer, filter, searchQ, page])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDiff()
    }, 120)
    return () => clearTimeout(timer)
  }, [loadDiff])

  const handleManualBackup = async () => {
    setBackingUp(true)
    try {
      const updated = await triggerVersionBackup()
      onVersionStatusChange(updated)
      loadDiff()
    } finally {
      setBackingUp(false)
    }
  }

  const backups = versionStatus?.backups || []

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* 1. 顶部版本选择与备份状态控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8eaec] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <GitCompare className="h-4 w-4 text-[#1b6c80]" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-[#131416]">
                客户端版本变更对比 (Version Diff)
              </h2>
              {versionStatus?.hasVersionUpdate ? (
                <span className="pill pill-positive">检测到游戏版本已更新</span>
              ) : (
                <span className="pill pill-neutral">本地备份已同步</span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-[#5d5f60]">
              每次启动自动读取 <code className="font-mono">ffxivgame.ver</code>{' '}
              并将快照备份于项目 <code className="font-mono">data/backups/</code>{' '}
              目录，支持任意两版数据对比
            </p>
          </div>
        </div>

        {/* 版本对比选择器与手动备份按钮 */}
        <div className="flex flex-wrap items-center gap-2.5 text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#5d5f60]">基准版本:</span>
            <select
              value={fromVer || diffData?.fromVersion || ''}
              onChange={(e) => {
                setFromVer(e.target.value)
                setPage(1)
              }}
              className="h-8 rounded-[6px] border border-[#cdced1] bg-white px-2.5 text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
            >
              {backups.map((b) => (
                <option key={b.version} value={b.version}>
                  {b.version} {b.isBaseline ? '(历史基准快照)' : '(本地备份)'}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="h-3.5 w-3.5 text-[#6b6b6b]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#5d5f60]">当前版本:</span>
            <select
              value={toVer || diffData?.toVersion || ''}
              onChange={(e) => {
                setToVer(e.target.value)
                setPage(1)
              }}
              className="h-8 rounded-[6px] border border-[#cdced1] bg-white px-2.5 text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
            >
              {backups.map((b) => (
                <option key={b.version} value={b.version}>
                  {b.version} {b.isBaseline ? '(历史基准快照)' : '(当前客户端)'}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={backingUp}
            onClick={handleManualBackup}
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#cdced1] bg-[#f4f6f8] px-3 text-[12px] font-medium text-[#131416] transition-colors hover:bg-[#ebedee] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${backingUp ? 'animate-spin' : ''}`}
            />
            <span>刷新本地快照备份</span>
          </button>
        </div>
      </div>

      {/* 2. 四栏分割 KPI 统计带 (严格遵循 Taste-Skill 无圆圈图标、纯数字对齐规范) */}
      {diffData && (
        <div className="kpi-strip">
          <div className="kpi-cell">
            <div className="kpi-label">版本新增道具</div>
            <div className="kpi-value text-[#1e7b4f]">
              +{diffData.summary.addedItems.toLocaleString()}
            </div>
            <div className="kpi-meta">
              对比基准版本 {diffData.fromVersion} 新增条目
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">属性与获取途径变更</div>
            <div className="kpi-value">
              {diffData.summary.modifiedItems.toLocaleString()}
            </div>
            <div className="kpi-meta">
              含售价调整、新增商店兑换或配方开放
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">新增制作配方</div>
            <div className="kpi-value">
              +{diffData.summary.addedRecipes.toLocaleString()}
            </div>
            <div className="kpi-meta">
              涉及 {diffData.summary.newCraftableItems.toLocaleString()} 项可制作成品
            </div>
          </div>

          <div className="kpi-cell">
            <div className="kpi-label">新增 NPC 商店可购项</div>
            <div className="kpi-value text-[#1b6c80]">
              +{diffData.summary.newPurchasableItems.toLocaleString()}
            </div>
            <div className="kpi-meta">
              新增可采集项 +{diffData.summary.newGatherableItems.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* 3. 筛选标签与搜索工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaec] bg-[#f9fbfc] px-5 py-2.5">
        <div className="flex items-center gap-1">
          {DIFF_FILTER_TABS.map((tab) => {
            const active = filter === tab.mode
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() => {
                  setFilter(tab.mode)
                  setPage(1)
                }}
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
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value)
                setPage(1)
              }}
              placeholder="筛选变更道具名称、分类或 ID..."
              className="h-7 w-full rounded-[6px] border border-[#cdced1] bg-white pr-3 pl-8 text-[12px] text-[#131416] placeholder-[#6b6b6b] focus:border-[#1b6c80] focus:outline-none"
            />
          </div>
          {diffData && (
            <span className="text-[12px] text-[#5d5f60] num">
              共匹配 <strong className="text-[#131416]">{diffData.totalFiltered.toLocaleString()}</strong> 条变更
            </span>
          )}
        </div>
      </div>

      {/* 4. 变更明细数据表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-[13px] text-[#5d5f60]">
            正在计算版本间数据差异...
          </div>
        ) : !diffData || diffData.items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-1 text-[13px] text-[#5d5f60]">
            <p>当前筛选条件下暂无版本变更记录</p>
            <p className="text-[12px] text-[#6b6b6b]">
              可切换顶部基准版本或清空搜索关键词后重试
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[#e8eaec] bg-[#f9fbfc] text-[12px] font-medium text-[#5d5f60]">
              <tr>
                <th className="w-24 px-4 py-2.5 text-right font-medium" data-num>
                  道具 ID
                </th>
                <th className="px-4 py-2.5 font-medium">道具名称与分类</th>
                <th className="w-24 px-3 py-2.5 text-right font-medium" data-num>
                  品级
                </th>
                <th className="w-28 px-3 py-2.5 font-medium">变更类型</th>
                <th className="w-44 px-3 py-2.5 font-medium">获取途径标识</th>
                <th className="px-4 py-2.5 font-medium">
                  字段变更对比 (变更前 → 变更后)
                </th>
                <th className="w-28 px-4 py-2.5 text-right font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f1f2]">
              {diffData.items.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-[#f9fbfc]"
                >
                  <td
                    className="px-4 py-2.5 text-right text-[12px] text-[#5d5f60] num"
                    data-num
                  >
                    #{item.id}
                  </td>

                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getIconUrl(item.iconId)}
                        alt={item.nameCn}
                        className="h-7 w-7 shrink-0 rounded-[4px] border border-[#e8eaec] bg-[#f4f6f8]"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[#131416]">
                          {item.nameCn}
                        </div>
                        <div className="truncate text-[11px] text-[#5d5f60]">
                          {item.categoryName}
                          {item.nameEn ? ` · ${item.nameEn}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td
                    className="px-3 py-2.5 text-right text-[12px] text-[#131416] num"
                    data-num
                  >
                    {item.itemLevel}
                  </td>

                  <td className="px-3 py-2.5">
                    {item.changeType === 'added' && (
                      <span className="pill pill-positive">新增道具</span>
                    )}
                    {item.changeType === 'modified' && (
                      <span className="pill pill-warning">属性变更</span>
                    )}
                    {item.changeType === 'removed' && (
                      <span className="pill pill-negative">已移除</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {item.isCraftable && (
                        <span className="pill pill-neutral">配方</span>
                      )}
                      {item.isGatherable && (
                        <span className="pill pill-positive">采集</span>
                      )}
                      {item.isPurchasable && (
                        <span className="pill pill-accent">商店</span>
                      )}
                      {!item.isCraftable &&
                        !item.isGatherable &&
                        !item.isPurchasable && (
                          <span className="text-[11px] text-[#6b6b6b]">-</span>
                        )}
                    </div>
                  </td>

                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {item.changes.map((chg, idx) => (
                        <span
                          key={`${chg.field}-${idx}`}
                          className="inline-flex items-center gap-1 rounded-[4px] border border-[#e8eaec] bg-[#f4f6f8] px-2 py-0.5 text-[11px] text-[#131416] num"
                        >
                          <span className="text-[#5d5f60]">{chg.label}:</span>
                          <span className="text-[#6b6b6b] line-through">
                            {chg.before}
                          </span>
                          <ArrowRight className="h-2.5 w-2.5 text-[#6b6b6b]" />
                          <span className="font-medium text-[#131416]">
                            {chg.after}
                          </span>
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    {item.changeType !== 'removed' && (
                      <button
                        type="button"
                        onClick={() => onInspectItem(item.id)}
                        className="rounded-[5px] border border-[#cdced1] bg-white px-2.5 py-1 text-[12px] font-medium text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80]"
                      >
                        查看详情
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. 底部分页控制栏 */}
      {diffData && diffData.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#e8eaec] bg-[#f9fbfc] px-5 py-2.5 text-[12px]">
          <span className="text-[#5d5f60] num">
            第 {diffData.page} / {diffData.totalPages} 页 (共{' '}
            {diffData.totalFiltered.toLocaleString()} 项变更)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={diffData.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#131416] hover:bg-[#f4f6f8] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一页
            </button>
            <button
              type="button"
              disabled={diffData.page >= diffData.totalPages}
              onClick={() =>
                setPage((p) => Math.min(diffData.totalPages, p + 1))
              }
              className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2.5 text-[#131416] hover:bg-[#f4f6f8] disabled:opacity-40"
            >
              下一页
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
