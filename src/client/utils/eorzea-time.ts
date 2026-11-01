import type { GatheringTimeWindow } from '../../shared/types'

/**
 * 艾欧泽亚时间 (ET) 与现实时间换算比例：1 艾欧泽亚日 = 70 现实分钟 (3600 / 175 倍)
 */
const EORZEA_MULTIPLIER = 3600 / 175

export interface EorzeaClock {
  hours: number
  minutes: number
  totalMinutesOfDay: number
  formatted: string
}

/**
 * 获取当前时刻对应的艾欧泽亚时间 (ET)
 */
export function getCurrentEorzeaTime(nowMs: number = Date.now()): EorzeaClock {
  const eorzeaMs = nowMs * EORZEA_MULTIPLIER
  const totalMinutes = Math.floor(eorzeaMs / 60000)
  const totalMinutesOfDay = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(totalMinutesOfDay / 60)
  const minutes = totalMinutesOfDay % 60
  return {
    hours,
    minutes,
    totalMinutesOfDay,
    formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  }
}

/**
 * 将艾欧泽亚分钟差换算为现实世界秒数
 */
function eorzeaMinutesToRealSeconds(etMinutes: number): number {
  return Math.max(0, Math.round((etMinutes * 60) / EORZEA_MULTIPLIER))
}

/**
 * 将现实秒数格式化为 "X分Y秒"
 */
export function formatRealDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `${secs}秒`
  return `${mins}分${String(secs).padStart(2, '0')}秒`
}

export interface TimedNodeActiveStatus {
  isActive: boolean
  activeWindow?: GatheringTimeWindow
  nextWindow?: GatheringTimeWindow
  realSecondsRemaining: number
  statusText: string
}

/**
 * 评估限时采集点在当前艾欧泽亚时间下是否处于开放状态，以及距离结束或下次开放的现实时间
 */
export function evaluateGatheringWindows(
  windows: GatheringTimeWindow[],
  nowMs: number = Date.now(),
): TimedNodeActiveStatus {
  if (!windows || windows.length === 0) {
    return {
      isActive: true,
      realSecondsRemaining: 0,
      statusText: '常驻开放',
    }
  }

  const et = getCurrentEorzeaTime(nowMs)
  const curMin = et.totalMinutesOfDay

  for (const win of windows) {
    const start = win.startMinuteOfDay
    const dur = win.durationMinutes
    const elapsed = (curMin - start + 1440) % 1440
    if (elapsed < dur) {
      const etRemain = dur - elapsed
      const realSec = eorzeaMinutesToRealSeconds(etRemain)
      return {
        isActive: true,
        activeWindow: win,
        realSecondsRemaining: realSec,
        statusText: `采集开放中 · 剩余 ${formatRealDuration(realSec)}`,
      }
    }
  }

  // 计算距离最近下一个窗口开启的艾欧泽亚分钟差
  let bestWaitEtMin = Infinity
  let nextWin = windows[0]
  for (const win of windows) {
    const waitMin = (win.startMinuteOfDay - curMin + 1440) % 1440
    if (waitMin < bestWaitEtMin) {
      bestWaitEtMin = waitMin
      nextWin = win
    }
  }

  const realSecWait = eorzeaMinutesToRealSeconds(bestWaitEtMin)
  return {
    isActive: false,
    nextWindow: nextWin,
    realSecondsRemaining: realSecWait,
    statusText: `距下次开放 (${nextWin.startEt}) 还有 ${formatRealDuration(realSecWait)}`,
  }
}
