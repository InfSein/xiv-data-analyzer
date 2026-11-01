import type {
  ItemDetail,
  ItemSearchQuery,
  ItemSearchResponse,
  SystemStatus,
  VersionDiffQuery,
  VersionDiffResponse,
  VersionStatusResponse,
} from '../shared/types'

/**
 * 获取系统状态与字典分类列表
 */
export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch('/api/status')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `请求系统状态失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 搜索与筛选道具列表
 */
export async function fetchItems(
  query: ItemSearchQuery,
): Promise<ItemSearchResponse> {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.categoryId && query.categoryId > 0) {
    params.set('categoryId', String(query.categoryId))
  }
  if (query.filter && query.filter !== 'all') {
    params.set('filter', query.filter)
  }
  if (query.craftTypeId !== undefined && query.craftTypeId >= 0) {
    params.set('craftTypeId', String(query.craftTypeId))
  }
  if (query.minIlvl && query.minIlvl > 0) {
    params.set('minIlvl', String(query.minIlvl))
  }
  if (query.maxIlvl && query.maxIlvl > 0) {
    params.set('maxIlvl', String(query.maxIlvl))
  }
  if (query.tradableOnly) {
    params.set('tradableOnly', '1')
  }
  if (query.sort) {
    params.set('sort', query.sort)
  }
  if (query.page) {
    params.set('page', String(query.page))
  }
  if (query.pageSize) {
    params.set('pageSize', String(query.pageSize))
  }

  const res = await fetch(`/api/items?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `搜索道具失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 获取单个道具完整详情
 */
export async function fetchItemDetail(itemId: number): Promise<ItemDetail> {
  const res = await fetch(`/api/items/${itemId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `获取道具详情失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 获取客户端版本检查与本地快照备份状态
 */
export async function fetchVersionStatus(): Promise<VersionStatusResponse> {
  const res = await fetch('/api/version/status')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `获取版本状态失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 手动刷新当前版本的本地快照备份
 */
export async function triggerVersionBackup(): Promise<VersionStatusResponse> {
  const res = await fetch('/api/version/backup', { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `执行版本备份失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 对比两个客户端版本快照之间的差异
 */
export async function fetchVersionDiff(
  query: VersionDiffQuery,
): Promise<VersionDiffResponse> {
  const params = new URLSearchParams()
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.filter && query.filter !== 'all') params.set('filter', query.filter)
  if (query.q) params.set('q', query.q)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))

  const res = await fetch(`/api/version/diff?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `获取版本对比差异失败 (${res.status})`)
  }
  return res.json()
}

/**
 * 生成本地游戏图标 URL
 */
export function getIconUrl(iconId: number, isHq = false): string {
  if (!iconId || iconId <= 0) return ''
  return `/api/icon/${iconId}${isHq ? '?hq=1' : ''}`
}

/**
 * 生成本地游戏地图贴图 URL
 */
export function getMapUrl(mapPath: string): string {
  if (!mapPath) return ''
  return `/api/map?path=${encodeURIComponent(mapPath)}`
}
