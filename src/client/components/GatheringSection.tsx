import {
  Anchor,
  BookOpen,
  Clock,
  Compass,
  Fish,
  MapPin,
  Pickaxe,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GatheringMethodDetail } from '../../shared/types'
import { getIconUrl } from '../api'
import { evaluateGatheringWindows } from '../utils/eorzea-time'
import type { MapMarkerData } from './MapModal'

interface GatheringSectionProps {
  itemName: string
  gathering: GatheringMethodDetail
  onOpenMap: (marker: MapMarkerData) => void
}

/**
 * 大地使者采集、捕鱼人垂钓与刺鱼渔场面板 (To-B Framed-Sheet 风格)
 */
export function GatheringSection({
  itemName,
  gathering,
  onOpenMap,
}: GatheringSectionProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { nodes, fishingSpots, spearfishing } = gathering
  if (
    nodes.length === 0 &&
    fishingSpots.length === 0 &&
    spearfishing.length === 0
  ) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* 1. 采矿工与园艺工采集点 */}
      {nodes.length > 0 && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <Pickaxe className="h-4 w-4 text-[#1e7b4f]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                大地使者采集点 (采矿 / 园艺)
              </h3>
              <span className="pill pill-positive num">
                {nodes.length} 处采集点
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2">
            {nodes.map((node) => {
              const timedStatus = node.isTimed
                ? evaluateGatheringWindows(node.timeWindows, nowMs)
                : null

              return (
                <div
                  key={`${node.pointId}-${node.baseId}`}
                  className="flex flex-col justify-between rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getIconUrl(node.gatheringTypeIconId)}
                          alt={node.gatheringTypeName}
                          className="h-8 w-8 rounded-[5px] border border-[#e8eaec] bg-white p-1"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-[#131416]">
                              {node.disciplineName} · {node.gatheringTypeName}
                            </span>
                            <span className="pill pill-positive num">
                              Lv.{node.nodeLevel}
                              {node.stars > 0 ? ` · ${node.stars}星` : ''}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12px] text-[#5d5f60]">
                            {node.regionName} &gt; {node.zoneName} &gt;{' '}
                            <strong className="font-medium text-[#131416]">
                              {node.placeName}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {node.mapPath && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMap({
                              title: `${itemName} (${node.disciplineName} Lv.${node.nodeLevel})`,
                              subtitle: node.gatheringTypeName,
                              regionName: node.regionName,
                              zoneName: node.zoneName,
                              placeName: node.placeName,
                              mapPath: node.mapPath,
                              coordX: node.coordX,
                              coordY: node.coordY,
                              normX: node.normX,
                              normY: node.normY,
                              radius: node.radius,
                            })
                          }
                          className="inline-flex shrink-0 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2 py-1 text-[11px] font-medium text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80] num"
                        >
                          <MapPin className="h-3 w-3 text-[#1b6c80]" />
                          <span>
                            (X:{node.coordX}, Y:{node.coordY}) 地图
                          </span>
                        </button>
                      )}
                    </div>

                    {(node.folkloreBookName ||
                      node.isHidden ||
                      node.isEphemeral ||
                      node.isTimed) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {node.folkloreBookName && (
                          <span className="pill pill-warning">
                            <BookOpen className="h-3 w-3" />
                            需传承录: {node.folkloreBookName}
                          </span>
                        )}
                        {node.isHidden && (
                          <span className="pill pill-neutral">隐藏采集物</span>
                        )}
                        {node.isEphemeral && (
                          <span className="pill pill-accent">精选限时采集点</span>
                        )}
                        {node.isTimed && !node.isEphemeral && (
                          <span className="pill pill-warning">
                            未知/传说限时采集点
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {node.isTimed && timedStatus && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[5px] border border-[#e8eaec] bg-white px-3 py-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 text-[#5d5f60]">
                        <Clock className="h-3 w-3 text-[#1b6c80]" />
                        <span>ET 时段:</span>
                        {node.timeWindows.map((w, i) => (
                          <span
                            key={i}
                            className="rounded-[4px] bg-[#f4f6f8] px-1.5 py-0.5 text-[#131416] num"
                          >
                            {w.startEt} – {w.endEt}
                          </span>
                        ))}
                      </div>
                      <span
                        className={
                          timedStatus.isActive
                            ? 'pill pill-positive num'
                            : 'pill pill-warning num'
                        }
                      >
                        {timedStatus.statusText}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 2. 捕鱼人垂钓钓场 */}
      {fishingSpots.length > 0 && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <Fish className="h-4 w-4 text-[#1b6c80]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                捕鱼人垂钓钓场
              </h3>
              <span className="pill pill-accent num">
                {fishingSpots.length} 处钓场
              </span>
            </div>
          </div>

          <div className="p-4">
            {fishingSpots[0]?.fishGuideText && (
              <div className="mb-3 rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#131416]">
                <strong className="font-semibold text-[#1b6c80]">
                  鱼类图鉴记载：
                </strong>
                {fishingSpots[0].fishGuideText}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {fishingSpots.map((spot) => (
                <div
                  key={spot.spotId}
                  className="flex items-center justify-between gap-3 rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getIconUrl(62018)}
                      alt="捕鱼人"
                      className="h-8 w-8 rounded-[5px] border border-[#e8eaec] bg-white p-1"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-[#131416]">
                          {spot.placeName}
                        </span>
                        <span className="pill pill-accent num">
                          Lv.{spot.level} · {spot.categoryName}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#5d5f60]">
                        {spot.regionName} &gt; {spot.zoneName}
                      </div>
                      {spot.folkloreBookName && (
                        <div className="mt-1 text-[11px] text-[#92400e]">
                          需传承录: {spot.folkloreBookName}
                        </div>
                      )}
                    </div>
                  </div>

                  {spot.mapPath && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenMap({
                          title: `${itemName} (钓场: ${spot.placeName})`,
                          subtitle: `Lv.${spot.level} ${spot.categoryName}`,
                          regionName: spot.regionName,
                          zoneName: spot.zoneName,
                          placeName: spot.placeName,
                          mapPath: spot.mapPath,
                          coordX: spot.coordX,
                          coordY: spot.coordY,
                          normX: spot.normX,
                          normY: spot.normY,
                          radius: spot.radius,
                        })
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2 py-1 text-[11px] font-medium text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80] num"
                    >
                      <Compass className="h-3 w-3 text-[#1b6c80]" />
                      <span>
                        (X:{spot.coordX}, Y:{spot.coordY}) 地图
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. 捕鱼人刺鱼渔场 */}
      {spearfishing.length > 0 && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <Anchor className="h-4 w-4 text-[#1b6c80]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                捕鱼人刺鱼渔场 (叉鱼)
              </h3>
              <span className="pill pill-accent num">
                {spearfishing.length} 处渔场
              </span>
            </div>
          </div>

          <div className="p-4">
            {spearfishing[0]?.description && (
              <div className="mb-3 rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#131416]">
                <strong className="font-semibold text-[#1b6c80]">
                  图鉴说明：
                </strong>
                {spearfishing[0].description}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {spearfishing.map((sf) => (
                <div
                  key={sf.notebookId}
                  className="flex items-center justify-between gap-3 rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[#131416]">
                        {sf.placeName}
                      </span>
                      <span className="pill pill-accent num">Lv.{sf.level}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#5d5f60]">
                      {sf.regionName} &gt; {sf.zoneName}
                    </div>
                  </div>

                  {sf.mapPath && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenMap({
                          title: `${itemName} (刺鱼: ${sf.placeName})`,
                          subtitle: `Lv.${sf.level} 刺鱼渔场`,
                          regionName: sf.regionName,
                          zoneName: sf.zoneName,
                          placeName: sf.placeName,
                          mapPath: sf.mapPath,
                          coordX: sf.coordX,
                          coordY: sf.coordY,
                          normX: sf.normX,
                          normY: sf.normY,
                          radius: sf.radius,
                        })
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-[5px] border border-[#cdced1] bg-white px-2 py-1 text-[11px] font-medium text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80] num"
                    >
                      <MapPin className="h-3 w-3 text-[#1b6c80]" />
                      <span>
                        (X:{sf.coordX}, Y:{sf.coordY}) 地图
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
