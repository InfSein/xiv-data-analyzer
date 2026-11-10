import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ItemSummary } from '../../shared/types'
import { getIconUrl } from '../api'

interface ItemListProps {
  items: ItemSummary[]
  total: number
  page: number
  totalPages: number
  selectedId: number | null
  loading: boolean
  onSelect: (id: number) => void
  onPageChange: (page: number) => void
}

/**
 * 左侧主从视图道具检索表 (To-B Framed-Sheet 风格)
 */
export function ItemList({
  items,
  total,
  page,
  totalPages,
  selectedId,
  loading,
  onSelect,
  onPageChange,
}: ItemListProps) {
  const [pageInput, setPageInput] = useState<string>(String(page))

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const commitPageInput = () => {
    const parsed = parseInt(pageInput.trim(), 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(page))
      return
    }
    const target = Math.max(1, Math.min(totalPages, parsed))
    setPageInput(String(target))
    if (target !== page) {
      onPageChange(target)
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-[#e8eaec] bg-white">
      {/* 列表表头栏 */}
      <div className="flex items-center justify-between border-b border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2 text-[12px] text-[#5d5f60]">
        <span className="num">
          检索结果 <strong className="font-semibold text-[#131416]">{total.toLocaleString()}</strong> 项
        </span>
        <span className="text-[11px] text-[#6b6b6b] num">
          页码 {page} / {totalPages}
        </span>
      </div>

      {/* 道具列表主体 */}
      <div className="flex-1 divide-y divide-[#f0f1f2] overflow-y-auto">
        {loading ? (
          <div className="flex h-56 items-center justify-center text-[13px] text-[#5d5f60]">
            正在检索本地客户端数据...
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 px-4 text-center text-[13px] text-[#5d5f60]">
            <p>未找到符合筛选条件的道具</p>
            <p className="text-[11px] text-[#6b6b6b]">
              请调整关键词或点击顶部“重置”按钮清空过滤项
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-[#ebedee]'
                    : 'bg-white hover:bg-[#f9fbfc]'
                }`}
              >
                {/* 道具图标 */}
                <img
                  src={getIconUrl(item.iconId)}
                  alt={item.nameCn}
                  loading="lazy"
                  className="h-8 w-8 shrink-0 rounded-[5px] border border-[#e8eaec] bg-[#f4f6f8] object-contain"
                />

                {/* 名称与获取途径标签 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-[#131416]">
                      {item.nameCn}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#6b6b6b] num">
                      #{item.id}
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-[#5d5f60]">
                      {item.categoryName}
                      {item.nameEn ? ` · ${item.nameEn}` : ''}
                    </span>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[11px] text-[#5d5f60] num">
                        iLvl {item.itemLevel}
                      </span>
                      {item.isCraftable && (
                        <span className="pill pill-neutral">配方</span>
                      )}
                      {item.isGatherable && (
                        <span className="pill pill-positive">采集</span>
                      )}
                      {item.isPurchasable && (
                        <span className="pill pill-accent">商店</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* 底部分页控制器 */}
      <div className="flex items-center justify-between gap-1.5 border-t border-[#e8eaec] bg-[#f9fbfc] px-3 py-2 text-[12px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="跳到第一页"
            aria-label="第一页"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#cdced1] bg-white text-[#131416] transition-colors hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-7 items-center gap-0.5 rounded-[5px] border border-[#cdced1] bg-white px-2 text-[#131416] transition-colors hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>上一页</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-[#5d5f60] num">
          <input
            type="text"
            inputMode="numeric"
            aria-label="输入跳转页码"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
                commitPageInput()
              }
            }}
            className="h-6 w-12 rounded-[4px] border border-[#cdced1] bg-white px-1.5 text-center text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
          />
          <span>/ {totalPages}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-7 items-center gap-0.5 rounded-[5px] border border-[#cdced1] bg-white px-2 text-[#131416] transition-colors hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>下一页</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="跳到最后一页"
            aria-label="最后一页"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#cdced1] bg-white text-[#131416] transition-colors hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
