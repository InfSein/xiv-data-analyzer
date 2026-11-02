import {
  AlertCircle,
  CheckCircle2,
  Download,
  FolderArchive,
  HardDrive,
  Info,
  Loader2,
  StopCircle,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  cancelLocalUnpack,
  fetchExportConfig,
  fetchExportMeta,
  fetchLocalUnpackStatus,
  getExportDownloadUrl,
  type LocalUnpackStatusResponse,
  saveExportConfig,
  triggerLocalUnpack,
} from '../api'

interface ExportCsvModalProps {
  isOpen: boolean
  onClose: () => void
}

const ALL_LANGUAGES: Array<{
  code: string
  label: string
  server: string
}> = [
  { code: 'chs', label: '简体中文', server: '国服' },
  { code: 'ja', label: '日本語', server: '国际服' },
  { code: 'en', label: 'English', server: '国际服' },
  { code: 'de', label: 'Deutsch', server: '国际服' },
  { code: 'fr', label: 'Français', server: '国际服' },
]

export function ExportCsvModal({ isOpen, onClose }: ExportCsvModalProps) {
  const [totalSheetsCount, setTotalSheetsCount] = useState<number>(7912)
  const [localOutputDir, setLocalOutputDir] = useState<string>('')

  // 语言选择（默认全选 5 种语言）
  const [selectedLangs, setSelectedLangs] = useState<string[]>([
    'chs',
    'ja',
    'en',
    'de',
    'fr',
  ])

  // 本地解包任务状态
  const [unpackStatus, setUnpackStatus] =
    useState<LocalUnpackStatusResponse | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  // 打开弹窗时加载元数据与已保存的本地目录配置
  useEffect(() => {
    if (!isOpen) return
    let active = true

    fetchExportMeta()
      .then((data) => {
        if (!active) return
        if (data.totalSheets) setTotalSheetsCount(data.totalSheets)
        if (data.savedOutputDir) {
          setLocalOutputDir(data.savedOutputDir)
        }
      })
      .catch((err) => {
        console.warn('获取导出元数据失败:', err)
      })

    fetchExportConfig()
      .then((cfg) => {
        if (!active) return
        if (cfg.localOutputDir) {
          setLocalOutputDir(cfg.localOutputDir)
        }
      })
      .catch((err) => {
        console.warn('读取本地解包配置失败:', err)
      })

    // 轮询当前任务状态
    fetchLocalUnpackStatus().then((st) => {
      if (active && st.isRunning) {
        setUnpackStatus(st)
      }
    })

    return () => {
      active = false
    }
  }, [isOpen])

  // 任务运行时定时轮询状态
  useEffect(() => {
    if (!isOpen || !unpackStatus?.isRunning) return

    const timer = setInterval(() => {
      fetchLocalUnpackStatus()
        .then((status) => {
          setUnpackStatus(status)
          if (!status.isRunning) {
            clearInterval(timer)
          }
        })
        .catch(() => {
          // 容错轮询
        })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, unpackStatus?.isRunning])

  // 切换语言选中
  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((c) => c !== code)
          : prev
        : [...prev, code],
    )
  }

  // 保存本地目录配置
  const handleSaveDirConfig = async () => {
    if (!localOutputDir.trim()) return
    setActionError(null)
    try {
      await saveExportConfig(localOutputDir.trim())
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '保存配置失败')
    }
  }

  // 触发解包到本地
  const handleStartLocalUnpack = async () => {
    if (!localOutputDir.trim()) {
      setActionError('请先输入有效的本地输出绝对目录')
      return
    }
    setActionError(null)
    try {
      await handleSaveDirConfig()
      const res = await triggerLocalUnpack(localOutputDir.trim(), selectedLangs)
      setUnpackStatus(res.status)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '启动解包失败')
    }
  }

  // 取消解包任务
  const handleCancelLocalUnpack = async () => {
    try {
      await cancelLocalUnpack()
      setUnpackStatus((prev) => (prev ? { ...prev, isRunning: false, isCancelled: true } : null))
    } catch (err) {
      console.warn('取消失败:', err)
    }
  }

  // 触发直接下载 Zip 压缩包
  const handleDownloadZip = () => {
    if (selectedLangs.length === 0) return
    setIsDownloadingZip(true)
    setActionError(null)

    // 不传 sheets 参数，后端直接全量打包所有 CSV
    const downloadUrl = getExportDownloadUrl(selectedLangs)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `ffxiv-csv-all-${Date.now()}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setIsDownloadingZip(false)
    }, 3000)
  }

  if (!isOpen) return null

  const isRunning = unpackStatus?.isRunning === true
  const totalTasks = totalSheetsCount * selectedLangs.length

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-csv-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(19, 20, 22, 0.45)' }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[620px] flex-col rounded-[12px] border border-[#e8eaec] bg-white text-[#131416]">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between border-b border-[#f0f1f2] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4 text-[#1b6c80]" />
            <h2
              id="export-csv-title"
              className="text-[15px] font-semibold text-[#131416]"
            >
              游戏全量 CSV 解包与本地导出
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#6b6b6b] transition-colors hover:bg-[#f4f6f8] hover:text-[#131416]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 弹窗主体 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-[13px]">
          {/* 解包范围概览 */}
          <div className="flex items-center justify-between rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-2 font-medium text-[#131416]">
                <span>解包范围:</span>
                <span className="pill pill-accent">
                  全量导出 ({totalSheetsCount.toLocaleString()} 张数据表)
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-[#6b6b6b]">
              共 <span className="font-semibold text-[#131416] num">{totalTasks.toLocaleString()}</span> 个 CSV
            </div>
          </div>

          {/* 目标语言复选 (JEDF + chs) */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#5d5f60]">
              输出语言与服务器目录
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ALL_LANGUAGES.map((lang) => {
                const isSelected = selectedLangs.includes(lang.code)
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => !isRunning && toggleLang(lang.code)}
                    disabled={isRunning}
                    className={`flex flex-col items-center justify-center rounded-[6px] border p-2 text-center transition-colors disabled:opacity-60 ${
                      isSelected
                        ? 'border-[#1b6c80] bg-[#e3f2f6] text-[#134e5e]'
                        : 'border-[#e8eaec] bg-white text-[#5d5f60] hover:border-[#cdced1]'
                    }`}
                  >
                    <span className="text-[11px] font-semibold tracking-wider uppercase num">
                      {lang.code}/
                    </span>
                    <span className="mt-0.5 text-[11px]">{lang.label}</span>
                    <span className="text-[10px] text-[#6b6b6b]">
                      {lang.server}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 本地目录配置（持久化保存） */}
          <div className="rounded-[8px] border border-[#e8eaec] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="local-output-dir-input"
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#131416]"
              >
                <HardDrive className="h-3.5 w-3.5 text-[#1b6c80]" />
                <span>本地解包输出目录</span>
              </label>
            </div>

            <div className="flex gap-2">
              <input
                id="local-output-dir-input"
                type="text"
                value={localOutputDir}
                onChange={(e) => {
                  setLocalOutputDir(e.target.value)
                }}
                onBlur={handleSaveDirConfig}
                disabled={isRunning}
                placeholder="输入本地目标绝对路径，如: D:\Repositories\ffxiv-datamining-mixed"
                className="h-8 flex-1 rounded-[6px] border border-[#cdced1] bg-white px-2.5 text-[12px] text-[#131416] placeholder-[#6b6b6b] focus:border-[#1b6c80] focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="flex items-start gap-1 text-[11px] text-[#6b6b6b] leading-normal">
              <Info className="h-3 w-3 shrink-0 mt-0.5 text-[#1b6c80]" />
              <span>
                点击「解包到本地」后，程序将先自动扫描该目录下是否存在对应的语言文件夹（如 <span className="font-mono text-[#131416]">chs</span>、<span className="font-mono text-[#131416]">ja</span> 等），若存在则先进行递归清理清空，随后将全量 CSV 直接输出到各个语言目录中。
              </span>
            </div>
          </div>

          {/* 任务进度提示与监控 */}
          {unpackStatus && (
            <div className="rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] p-3 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-1.5 font-medium">
                  {unpackStatus.isRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1b6c80]" />
                      <span className="text-[#131416]">
                        正在解包本地文件 ({unpackStatus.currentLang}/
                        {unpackStatus.currentSheet})...
                      </span>
                    </>
                  ) : unpackStatus.isCompleted ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1e7b4f]" />
                      <span className="text-[#1e7b4f]">
                        本地解包已完成！已全部输出至目标目录
                      </span>
                    </>
                  ) : unpackStatus.isCancelled ? (
                    <span className="text-[#92400e]">解包任务已被用户取消</span>
                  ) : (
                    <span className="text-[#5d5f60]">任务状态就绪</span>
                  )}
                </div>
                <span className="font-semibold text-[#1b6c80] num">
                  {unpackStatus.percent || 0}%
                </span>
              </div>

              {/* 进度条 */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#ebedee]">
                <div
                  className="h-full bg-[#1b6c80] transition-all duration-300"
                  style={{ width: `${unpackStatus.percent || 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#6b6b6b]">
                <div>
                  已处理:{' '}
                  <span className="font-medium text-[#131416] num">
                    {(unpackStatus.processedTasks || 0).toLocaleString()}
                  </span>{' '}
                  / {totalTasks.toLocaleString()} 个文件
                </div>
                {unpackStatus.errorCount ? (
                  <div className="text-[#831c1e]">
                    跳过表数: {unpackStatus.errorCount}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {actionError && (
            <div className="flex items-center gap-1.5 rounded-[6px] bg-[#ffedea] p-2.5 text-[12px] text-[#831c1e]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        {/* 弹窗底部操作栏 */}
        <div className="flex items-center justify-between border-t border-[#f0f1f2] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="h-8 rounded-[6px] border border-[#cdced1] bg-white px-3 text-[12px] font-medium text-[#5d5f60] transition-colors hover:border-[#5d5f60] hover:text-[#131416] disabled:opacity-50"
          >
            关闭
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={handleCancelLocalUnpack}
                className="flex h-8 items-center gap-1.5 rounded-[6px] border border-[#831c1e] bg-white px-3 text-[12px] font-medium text-[#831c1e] transition-colors hover:bg-[#ffedea]"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>取消任务</span>
              </button>
            ) : null}

            {/* 下载 Zip 按钮 */}
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isRunning || isDownloadingZip || selectedLangs.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-[6px] border border-[#cdced1] bg-white px-3 text-[12px] font-medium text-[#131416] transition-colors hover:border-[#1b6c80] hover:text-[#1b6c80] disabled:opacity-50"
              title="打包所有 CSV 为 Zip 并通过浏览器下载"
            >
              {isDownloadingZip ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>正在请求 Zip...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>下载 Zip 压缩包</span>
                </>
              )}
            </button>

            {/* 解包到本地按钮 */}
            {!!localOutputDir.trim() && <button
              type="button"
              onClick={handleStartLocalUnpack}
              disabled={
                isRunning ||
                !localOutputDir.trim() ||
                selectedLangs.length === 0
              }
              className="flex h-8 items-center gap-1.5 rounded-[6px] bg-[#1d1f20] px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              title="先扫描清理已有文件夹，然后直接全量解包到配置目录"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>正在解包写入磁盘...</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5" />
                  <span>解包到本地</span>
                </>
              )}
            </button>}
          </div>
        </div>
      </div>
    </div>
  )
}
