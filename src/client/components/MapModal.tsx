import { Compass, MapPin, X } from 'lucide-react'
import { getMapUrl } from '../api'

export interface MapMarkerData {
  title: string
  subtitle: string
  regionName: string
  zoneName: string
  placeName: string
  mapPath: string
  coordX: number
  coordY: number
  normX: number
  normY: number
  radius?: number
}

interface MapModalProps {
  marker: MapMarkerData | null
  onClose: () => void
}

/**
 * 交互式游戏原生地贴图预览弹窗 (To-B Framed-Sheet 风格)
 */
export function MapModal({ marker, onClose }: MapModalProps) {
  if (!marker) return null

  const leftPercent = `${(marker.normX * 100).toFixed(2)}%`
  const topPercent = `${(marker.normY * 100).toFixed(2)}%`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-[#e8eaec] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between border-b border-[#e8eaec] bg-[#f9fbfc] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Compass className="h-4 w-4 text-[#1b6c80]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[#131416]">
                {marker.regionName} · {marker.zoneName}
                {marker.placeName && marker.placeName !== marker.zoneName
                  ? ` (${marker.placeName})`
                  : ''}
              </h3>
              <p className="text-[12px] text-[#5d5f60] num">
                {marker.title} - 坐标:{' '}
                <strong className="text-[#1b6c80]">
                  (X: {marker.coordX}, Y: {marker.coordY})
                </strong>{' '}
                · {marker.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#cdced1] bg-white p-1 text-[#5d5f60] transition-colors hover:bg-[#ebedee] hover:text-[#131416]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 地图贴图容器 */}
        <div className="relative aspect-square w-full max-w-[640px] self-center overflow-hidden bg-[#f4f6f8]">
          {marker.mapPath ? (
            <img
              src={getMapUrl(marker.mapPath)}
              alt={marker.zoneName}
              className="h-full w-full object-cover select-none"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-[#5d5f60]">
              该区域暂无可用地图贴图
            </div>
          )}

          {/* 坐标大头针标记 */}
          <div
            style={{ left: leftPercent, top: topPercent }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1b6c80] bg-white/90">
              <MapPin className="h-5 w-5 text-[#c4242a]" />
            </div>
            <div className="mt-1 rounded-[4px] border border-[#1d1f20] bg-[#1d1f20] px-2 py-0.5 text-center text-[11px] font-semibold whitespace-nowrap text-white num">
              X:{marker.coordX}, Y:{marker.coordY}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
