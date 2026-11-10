import fs from 'fs'
import path from 'path'
import express, { type Express, type Request, type Response } from 'express'
import type {
  DiffEntityType,
  DiffFilterType,
  ItemFilterMode,
  ItemSortMode,
} from '../shared/types'
import { loadGameDataStore } from './data-loader'
import { GameDataService } from './game-data-service'
import { VersionBackupService } from './version-backup'
import {
  ALL_SUPPORTED_LANGS,
  CsvExportService,
  type SupportedExportLang,
} from './csv-exporter'
import { CORE_SHEET_NAMES, SchemaManager } from './schema-manager'

const EXPORT_CONFIG_FILE = path.resolve(process.cwd(), 'data/export-config.json')

export interface ExportAppConfig {
  localOutputDir: string
}

export function loadExportConfig(): ExportAppConfig {
  try {
    if (fs.existsSync(EXPORT_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXPORT_CONFIG_FILE, 'utf8'))
      return {
        localOutputDir: typeof data.localOutputDir === 'string' ? data.localOutputDir : '',
      }
    }
  } catch (err) {
    console.warn('[ExportConfig] 读取导出配置失败:', err)
  }
  return { localOutputDir: '' }
}

export function saveExportConfig(config: ExportAppConfig): void {
  const dir = path.dirname(EXPORT_CONFIG_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(EXPORT_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
}

let servicePromise: Promise<GameDataService> | null = null
const backupServiceByDataService = new WeakMap<
  GameDataService,
  Promise<VersionBackupService>
>()
const exportServiceByDataService = new WeakMap<
  GameDataService,
  CsvExportService
>()

export function getExportService(dataService: GameDataService): CsvExportService {
  let exporter = exportServiceByDataService.get(dataService)
  if (!exporter) {
    const store = dataService.getStore()
    const schemaManager = new SchemaManager()
    exporter = new CsvExportService(
      store.cnReader,
      store.globalReader,
      schemaManager,
    )
    exportServiceByDataService.set(dataService, exporter)
  }
  return exporter
}

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
        entityType:
          typeof req.query.entityType === 'string'
            ? (req.query.entityType as DiffEntityType)
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

  // 搜索与多条件筛选成就与称号
  app.get('/api/achievements', async (req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const result = svc.searchAchievements({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        kindId: req.query.kindId ? Number(req.query.kindId) : undefined,
        filter:
          req.query.filter === 'with_title' || req.query.filter === 'with_item'
            ? req.query.filter
            : 'all',
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 30,
      })
      res.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `查询成就与称号列表失败: ${message}` })
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

  // 获取 CSV 导出可选元数据与已保存的本地配置
  app.get('/api/export/meta', async (_req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const exporter = getExportService(svc)
      const allSheets = await exporter.schemaManager.getAllSheetNames(
        svc.getStore().cnReader,
      )
      const config = loadExportConfig()
      res.json({
        totalSheets: allSheets.length,
        coreSheets: CORE_SHEET_NAMES,
        languages: ALL_SUPPORTED_LANGS,
        savedOutputDir: config.localOutputDir,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `获取导出元数据失败: ${message}` })
    }
  })

  // 读取已保存的本地解包配置
  app.get('/api/export/config', (_req: Request, res: Response) => {
    res.json(loadExportConfig())
  })

  // 保存本地解包配置
  app.post('/api/export/config', (req: Request, res: Response) => {
    try {
      const outputDir =
        typeof req.body?.localOutputDir === 'string'
          ? req.body.localOutputDir.trim()
          : ''
      saveExportConfig({ localOutputDir: outputDir })
      res.json({ success: true, localOutputDir: outputDir })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `保存配置失败: ${message}` })
    }
  })

  // 触发解包到本地目录
  app.post('/api/export/unpack-local', async (req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const exporter = getExportService(svc)

      const saved = loadExportConfig()
      const outputDir = (
        typeof req.body?.outputDir === 'string'
          ? req.body.outputDir.trim()
          : saved.localOutputDir
      ).trim()

      if (!outputDir) {
        res.status(400).json({ error: '请先配置本地解包目标目录' })
        return
      }

      // 若传入新目录，自动持久化保存
      if (outputDir !== saved.localOutputDir) {
        saveExportConfig({ localOutputDir: outputDir })
      }

      const rawLangs = Array.isArray(req.body?.langs)
        ? (req.body.langs as string[])
        : ALL_SUPPORTED_LANGS
      const langList = rawLangs.filter((l): l is SupportedExportLang =>
        ALL_SUPPORTED_LANGS.includes(l as SupportedExportLang),
      )

      await exporter.startUnpackToLocalDirectory(
        outputDir,
        langList.length > 0 ? langList : ALL_SUPPORTED_LANGS,
      )

      res.json({
        success: true,
        message: '解包任务已启动',
        status: exporter.getLocalUnpackStatus(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(400).json({ error: message })
    }
  })

  // 查询当前本地解包进度
  app.get('/api/export/unpack-status', async (_req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const exporter = getExportService(svc)
      res.json(exporter.getLocalUnpackStatus() || { isRunning: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `获取解包状态失败: ${message}` })
    }
  })

  // 取消当前本地解包任务
  app.post('/api/export/unpack-cancel', async (_req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const exporter = getExportService(svc)
      const cancelled = exporter.cancelLocalUnpack()
      res.json({ success: cancelled })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ error: `取消解包任务失败: ${message}` })
    }
  })

  // 导出全量或指定数据表为 Zip 压缩包（直接打包下载）
  app.get('/api/export/download', async (req: Request, res: Response) => {
    try {
      const svc = await resolveService()
      const exporter = getExportService(svc)

      const rawSheets = typeof req.query.sheets === 'string' ? req.query.sheets : ''
      const isAll = !rawSheets || rawSheets === 'all'
      const sheetList = isAll
        ? undefined
        : rawSheets
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)

      const rawLangs = typeof req.query.langs === 'string' ? req.query.langs : ''
      const langList = (
        rawLangs
          ? rawLangs.split(',').map((l) => l.trim().toLowerCase())
          : ALL_SUPPORTED_LANGS
      ).filter((l): l is SupportedExportLang =>
        ALL_SUPPORTED_LANGS.includes(l as SupportedExportLang),
      )

      const filename = `ffxiv-csv-${isAll ? 'all' : (sheetList?.[0] || 'mixed')}-${Date.now()}.zip`
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

      // 防止全量打包超时
      req.setTimeout(600000)
      res.setTimeout(600000)

      const zipStream = exporter.createExportZipStream(sheetList, langList)
      zipStream.pipe(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      if (!res.headersSent) {
        res.status(500).json({ error: `导出 CSV 失败: ${message}` })
      }
    }
  })

  return app
}
