import { AlertTriangle, GitCompare, History } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type {
  ItemDetail as ItemDetailType,
  ItemSearchQuery,
  ItemSummary,
  SystemStatus,
  VersionStatusResponse,
} from '../shared/types'
import {
  fetchItemDetail,
  fetchItems,
  fetchSystemStatus,
  fetchVersionStatus,
  getIconUrl,
} from './api'
import { type ActiveWorkspaceTab, Header } from './components/Header'
import { AchievementView } from './components/AchievementView'
import { ItemDetail } from './components/ItemDetail'
import { ItemList } from './components/ItemList'
import { MapModal, type MapMarkerData } from './components/MapModal'
import { SearchFilterBar } from './components/SearchFilterBar'
import { VersionDiffView } from './components/VersionDiffView'
import { ExportCsvModal } from './components/ExportCsvModal'

const DEFAULT_QUERY: ItemSearchQuery = {
  filter: 'all',
  sort: 'id_asc',
  page: 1,
  pageSize: 30,
}

/**
 * 顶层应用组件：基于 Taste-Skill Framed-Sheet 架构协调左侧导航、顶部检索框、版本检查 Diff 工作区与道具主从工作台
 */
export function App() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('workbench')
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [versionStatus, setVersionStatus] =
    useState<VersionStatusResponse | null>(null)
  const [dismissUpdateBanner, setDismissUpdateBanner] = useState(false)

  const [query, setQuery] = useState<ItemSearchQuery>(DEFAULT_QUERY)
  const [items, setItems] = useState<ItemSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(true)

  const [selectedId, setSelectedId] = useState<number | null>(44099)
  const [itemDetail, setItemDetail] = useState<ItemDetailType | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<
    Array<{ id: number; nameCn: string; iconId: number }>
  >([])

  const [activeMapMarker, setActiveMapMarker] = useState<MapMarkerData | null>(
    null,
  )
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 初始化加载系统状态与客户端版本检查状态
  useEffect(() => {
    fetchSystemStatus()
      .then((data) => {
        setStatus(data)
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : '加载系统状态失败')
      })

    fetchVersionStatus()
      .then((vData) => {
        setVersionStatus(vData)
        // 若启动检测到游戏版本发生了更新，自动切换到版本 Diff 对比界面提示用户
        if (vData.hasVersionUpdate) {
          setActiveTab('diff')
        }
      })
      .catch(() => {
        // 版本检查非阻塞
      })
  }, [])

  // 监听搜索与筛选条件变化，支持防抖查询
  useEffect(() => {
    const timer = setTimeout(() => {
      setListLoading(true)
      fetchItems(query)
        .then((res) => {
          setItems(res.items)
          setTotal(res.total)
          setTotalPages(res.totalPages)
          setErrorMsg(null)
        })
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : '查询道具列表失败')
        })
        .finally(() => {
          setListLoading(false)
        })
    }, 150)
    return () => clearTimeout(timer)
  }, [query])

  // 加载当前选中的道具详情并记录最近浏览历史
  const handleSelectItem = useCallback((itemId: number) => {
    setSelectedId(itemId)
    setDetailLoading(true)
    fetchItemDetail(itemId)
      .then((detail) => {
        setItemDetail(detail)
        setHistoryItems((prev) => {
          const filtered = prev.filter((x) => x.id !== detail.id)
          return [
            { id: detail.id, nameCn: detail.nameCn, iconId: detail.iconId },
            ...filtered,
          ].slice(0, 10)
        })
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : '加载道具详情失败')
      })
      .finally(() => {
        setDetailLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selectedId !== null) {
      handleSelectItem(selectedId)
    }
  }, [selectedId, handleSelectItem])

  const handleResetQuery = () => {
    setQuery(DEFAULT_QUERY)
  }

  const handleInspectFromDiff = (itemId: number) => {
    setSelectedId(itemId)
    setActiveTab('workbench')
  }

  return (
    <div className="app-shell">
      {/* L型外框导航：左侧 228px 导航栏 + 顶部 48px 工具栏 */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        status={status}
        versionStatus={versionStatus}
        query={query}
        onQueryChange={setQuery}
        onSelectPresetItem={setSelectedId}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* 内嵌白色工作台主画布 (.app-sheet) */}
      <main className="app-sheet">
        {/* 版本更新提示条 */}
        {versionStatus?.hasVersionUpdate &&
          activeTab !== 'diff' &&
          !dismissUpdateBanner && (
            <div className="flex items-center justify-between border-b border-[#e8eaec] bg-[#dcfae5] px-4 py-2 text-[12px] text-[#04250e]">
              <div className="flex items-center gap-2">
                <GitCompare className="h-3.5 w-3.5 text-[#1e7b4f]" />
                <span>
                  检测到本地 FF14 客户端版本已更新至{' '}
                  <strong className="num">
                    {versionStatus.currentVersion}
                  </strong>
                  （上一备份版本:{' '}
                  <strong className="num">
                    {versionStatus.previousVersion}
                  </strong>
                  ），已自动创建新快照备份。
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('diff')}
                  className="rounded-[5px] bg-[#1d1f20] px-2.5 py-1 text-[11px] font-medium text-white"
                >
                  查看版本变更对比
                </button>
                <button
                  type="button"
                  onClick={() => setDismissUpdateBanner(true)}
                  className="text-[11px] text-[#04250e] underline"
                >
                  忽略
                </button>
              </div>
            </div>
          )}

        {/* 错误提示条 */}
        {errorMsg && (
          <div className="flex items-center gap-2 border-b border-[#e8eaec] bg-[#ffedea] px-4 py-2 text-[12px] text-[#831c1e]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeTab === 'diff' ? (
          <VersionDiffView
            versionStatus={versionStatus}
            onVersionStatusChange={setVersionStatus}
            onInspectItem={handleInspectFromDiff}
          />
        ) : activeTab === 'achievements' ? (
          <AchievementView
            status={status}
            onInspectItem={handleInspectFromDiff}
          />
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* 顶部四栏 KPI 指标带与筛选工具栏 */}
            <SearchFilterBar
              status={status}
              query={query}
              categories={status?.categories || []}
              onChange={setQuery}
              onReset={handleResetQuery}
            />

            {/* 最近浏览历史足迹条 */}
            {historyItems.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#e8eaec] bg-white px-4 py-1.5 text-[11px]">
                <span className="flex shrink-0 items-center gap-1 text-[#6b6b6b]">
                  <History className="h-3 w-3" />
                  <span>最近查阅:</span>
                </span>
                {historyItems.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedId(h.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-[5px] border px-2 py-0.5 transition-colors ${
                      selectedId === h.id
                        ? 'border-[#1b6c80] bg-[#e3f2f6] font-medium text-[#134e5e]'
                        : 'border-[#e8eaec] bg-[#f9fbfc] text-[#5d5f60] hover:border-[#cdced1] hover:text-[#131416]'
                    }`}
                  >
                    <img
                      src={getIconUrl(h.iconId)}
                      alt={h.nameCn}
                      className="h-3.5 w-3.5 rounded-[2px]"
                    />
                    <span>{h.nameCn}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 主从双栏内容工作区 */}
            <div className="grid flex-1 overflow-hidden lg:grid-cols-12">
              {/* 左栏：道具检索结果列表 (4列) */}
              <div className="h-full overflow-hidden lg:col-span-4 xl:col-span-4">
                <ItemList
                  items={items}
                  total={total}
                  page={query.page || 1}
                  totalPages={totalPages}
                  selectedId={selectedId}
                  loading={listLoading}
                  onSelect={setSelectedId}
                  onPageChange={(nextPage) =>
                    setQuery((prev) => ({ ...prev, page: nextPage }))
                  }
                />
              </div>

              {/* 右栏：道具完整详情滚动工作区 (8列) */}
              <div className="h-full overflow-y-auto bg-[#f9fbfc] p-4 lg:col-span-8 xl:col-span-8">
                <ItemDetail
                  item={itemDetail}
                  loading={detailLoading}
                  onSelectItem={setSelectedId}
                  onOpenMap={setActiveMapMarker}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 游戏原生地贴图坐标预览弹窗 */}
      <MapModal
        marker={activeMapMarker}
        onClose={() => setActiveMapMarker(null)}
      />

      {/* CSV 解包导出弹窗 */}
      <ExportCsvModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  )
}
