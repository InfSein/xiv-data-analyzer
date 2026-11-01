import express, { type Express, type Request, type Response } from 'express'
import type {
  DiffFilterType,
  ItemFilterMode,
  ItemSortMode,
} from '../shared/types'
import { loadGameDataStore } from './data-loader'
import { GameDataService } from './game-data-service'
import { VersionBackupService } from './version-backup'

let servicePromise: Promise<GameDataService> | null = null
const backupServiceByDataService = new WeakMap<
  GameDataService,
  Promise<VersionBackupService>
>()

/**
 * 获取或初始化与指定 GameDataService 关联的 VersionBackupService
 */
export function getVersionBackupService(
  dataService: GameDataService,
): Promise<VersionBackupService> {
  let promise = backupServiceByDataService.get(dataService)
  if (!promise) {
    const backupSvc = new VersionBackupService(dataService.getStore())
    promise = backupSvc.initializeOnStartup().then((status) => {
      console.log(
        `[Version Check] 当前客户端版本 ${status.currentVersion}，本地快照数 ${status.backups.length}，版本更新状态: ${status.hasVersionUpdate ? '检测到新版本' : '未变更'}`,
      )
      return backupSvc
    })
    backupServiceByDataService.set(dataService, promise)
  }
  return promise
}

/**
 * 获取或初始化全局单例 GameDataService，并在启动时自动执行客户端版本检查与本地备份
 */
export function getSharedGameDataService(): Promise<GameDataService> {
  if (!servicePromise) {
    servicePromise = loadGameDataStore()
      .then(async (store) => {
        console.log(
          `[Elpis Data Engine] 已完成本地 FF14 数据解析 (${store.itemSummaries.length} 个道具, ${store.recipes.size} 个配方, ${store.totalActiveShops} 个商店, 耗时 ${store.loadTimeMs}ms)`,
        )
        const svc = new GameDataService(store)
        await getVersionBackupService(svc)
        return svc
      })
      .catch((err) => {
        servicePromise = null
        console.error('[Elpis Data Engine] 初始化本地游戏数据失败:', err)
        throw err
      })
  }
  return servicePromise
}

/**
 * 创建 Express API 应用实例
 */
export function createApiApp(customService?: GameDataService): Express {
  const app = express()
  app.use(express.json())

  const resolveService = async (): Promise<GameDataService> => {
    if (customService) return customService
    return getSharedGameDataService()
  }

  // 获取系统状态、分类字典与制作职业列表
  app.get('/api/status', async (_req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      res.json(svc.getSystemStatus())
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `读取本地游戏数据失败: ${message}` })
    }
  })

  // 获取客户端版本检查与本地备份状态
  app.get('/api/version/status', async (_req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const backupSvc = await getVersionBackupService(svc)
      res.json(backupSvc.getVersionStatus())
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `读取版本备份状态失败: ${message}` })
    }
  })

  // 手动刷新当前版本的本地快照备份
  app.post('/api/version/backup', async (_req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const backupSvc = await getVersionBackupService(svc)
      const status = await backupSvc.createOrRefreshBackup()
      res.json(status)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `执行本地版本备份失败: ${message}` })
    }
  })

  // 对比两个版本快照之间的道具、配方与获取途径差异
  app.get('/api/version/diff', async (req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const backupSvc = await getVersionBackupService(svc)
      const diff = await backupSvc.compareVersions({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        filter:
          typeof req.query.filter === 'string'
            ? (req.query.filter as DiffFilterType)
            : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 30,
      })
      res.json(diff)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `对比版本差异失败: ${message}` })
    }
  })

  // 搜索与多条件筛选道具
  app.get('/api/items', async (req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const result = svc.searchItems({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        categoryId: req.query.categoryId
          ? Number(req.query.categoryId)
          : undefined,
        filter:
          typeof req.query.filter === 'string'
            ? (req.query.filter as ItemFilterMode)
            : undefined,
        craftTypeId:
          req.query.craftTypeId !== undefined && req.query.craftTypeId !== ''
            ? Number(req.query.craftTypeId)
            : undefined,
        minIlvl: req.query.minIlvl ? Number(req.query.minIlvl) : undefined,
        maxIlvl: req.query.maxIlvl ? Number(req.query.maxIlvl) : undefined,
        tradableOnly:
          req.query.tradableOnly === '1' || req.query.tradableOnly === 'true',
        sort:
          typeof req.query.sort === 'string'
            ? (req.query.sort as ItemSortMode)
            : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 30,
      })
      res.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `查询道具列表失败: ${message}` })
    }
  })

  // 获取指定道具详情
  app.get('/api/items/:id', async (req: Request, res: Response) => {
    try {
      const itemId = Number(req.params.id)
      if (!Number.isInteger(itemId) || itemId <= 0) {
        res.status(400).json({ error: '无效的道具 ID' })
        return
      }
      const svc = await resolveService()
      const detail = svc.getItemDetail(itemId)
      if (!detail) {
        res.status(404).json({ error: `未找到 ID 为 ${itemId} 的道具` })
        return
      }
      res.json(detail)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `获取道具详情失败: ${message}` })
    }
  })

  // 获取并解码本地游戏图标 (.tex -> PNG)
  app.get('/api/icon/:iconId', async (req: Request, res: Response) => {
    try {
      const iconId = Number(req.params.iconId)
      const isHq = req.query.hq === '1' || req.query.hq === 'true'
      const svc = await resolveService()
      const pngBuffer = await svc.getIconPng(iconId, isHq)
      if (!pngBuffer) {
        res.status(404).json({ error: '未找到对应图标贴图' })
        return
      }
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(pngBuffer)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `解码图标贴图失败: ${message}` })
    }
  })

  // 获取并解码本地游戏地图贴图 (.tex -> PNG)
  app.get('/api/map', async (req: Request, res: Response) => {
    try {
      const mapPath = typeof req.query.path === 'string' ? req.query.path : ''
      if (!mapPath) {
        res.status(400).json({ error: '缺少地图路径参数 path' })
        return
      }
      const svc = await resolveService()
      const pngBuffer = await svc.getMapPng(mapPath)
      if (!pngBuffer) {
        res.status(404).json({ error: `未找到地图贴图: ${mapPath}` })
        return
      }
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(pngBuffer)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `解码地图贴图失败: ${message}` })
    }
  })

  return app
}
