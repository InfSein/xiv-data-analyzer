import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  DiffItemEntry,
  ItemFieldChange,
  VersionBackupMeta,
  VersionDiffQuery,
  VersionDiffResponse,
  VersionStatusResponse,
} from '../shared/types'
import type { LoadedGameStore } from './data-loader'

export interface CompactItemRecord {
  id: number
  nameCn: string
  nameEn: string
  iconId: number
  itemLevel: number
  equipLevel: number
  categoryId: number
  categoryName: string
  priceMid: number
  isCraftable: boolean
  isGatherable: boolean
  isPurchasable: boolean
}

export interface CompactAchievementRecord {
  id: number
  nameCn: string
  nameEn: string
  descriptionCn: string
  points: number
  iconId: number
  kindName: string
  categoryName: string
  titleId: number
  titleMasculineCn: string
  titleFeminineCn: string
  rewardItemId: number
  rewardItemNameCn: string
}

export interface SnapshotPayload {
  meta: VersionBackupMeta
  items: CompactItemRecord[]
  achievements?: CompactAchievementRecord[]
}

interface BackupManifest {
  latestVersion: string
  previousVersion: string | null
  hasVersionUpdate: boolean
  lastBackupAt: string
  backups: VersionBackupMeta[]
}

function sanitizeVersionFileName(version: string): string {
  return version.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * 负责启动时检查本地客户端版本、持久化版本快照备份以及计算跨版本数据变更 Diff
 */
export class VersionBackupService {
  private readonly backupDir: string
  private readonly manifestPath: string
  private manifest: BackupManifest | null = null
  private snapshotCache = new Map<string, SnapshotPayload>()

  constructor(
    private readonly store: LoadedGameStore,
    customBackupDir?: string,
  ) {
    this.backupDir =
      customBackupDir || path.resolve(process.cwd(), 'data', 'backups')
    this.manifestPath = path.join(this.backupDir, 'manifest.json')
  }

  /**
   * 启动时执行版本检查与自动备份
   * 若检测到本地游戏版本相较上一次备份发生变化，则标记 hasVersionUpdate 并记录新快照
   */
  async initializeOnStartup(): Promise<VersionStatusResponse> {
    await fs.mkdir(this.backupDir, { recursive: true })

    const currentVersion = this.store.cnVersion
    const existingManifest = await this.readManifest()
    const currentSnapshot = this.buildLiveSnapshotPayload(currentVersion)

    // 确保存在历史基准快照，以便在首次安装或尚未经历大版本更新时也能直接对比查看版本差异
    const baselineVersion = this.deriveBaselineVersionName(currentVersion)
    const hasBaselineFile = await this.snapshotFileExists(baselineVersion)
    let baselineMeta: VersionBackupMeta | null = null
    if (!hasBaselineFile) {
      const baselinePayload = this.buildBaselineSnapshotPayload(
        baselineVersion,
        currentSnapshot,
      )
      await this.writeSnapshotFile(baselineVersion, baselinePayload)
      baselineMeta = baselinePayload.meta
    } else {
      const loadedBaseline = await this.loadSnapshot(baselineVersion)
      if (loadedBaseline && loadedBaseline.achievements && loadedBaseline.achievements.length > 0) {
        baselineMeta = loadedBaseline.meta
      } else {
        const baselinePayload = this.buildBaselineSnapshotPayload(
          baselineVersion,
          currentSnapshot,
        )
        await this.writeSnapshotFile(baselineVersion, baselinePayload)
        baselineMeta = baselinePayload.meta
      }
    }

    const currentFileExists = await this.snapshotFileExists(currentVersion)
    await this.writeSnapshotFile(currentVersion, currentSnapshot)

    let previousVersion: string | null = null
    let hasVersionUpdate = false
    const backupsMap = new Map<string, VersionBackupMeta>()

    if (baselineMeta) {
      backupsMap.set(baselineMeta.version, baselineMeta)
    }

    if (existingManifest) {
      for (const b of existingManifest.backups) {
        if (await this.snapshotFileExists(b.version)) {
          backupsMap.set(b.version, b)
        }
      }

      if (existingManifest.latestVersion !== currentVersion) {
        // 检测到游戏客户端版本发生了更新
        previousVersion = existingManifest.latestVersion
        hasVersionUpdate = true
      } else {
        previousVersion =
          existingManifest.previousVersion ||
          (baselineMeta ? baselineMeta.version : null)
        hasVersionUpdate = existingManifest.hasVersionUpdate && !currentFileExists
      }
    } else {
      previousVersion = baselineMeta ? baselineMeta.version : null
      hasVersionUpdate = false
    }

    backupsMap.set(currentVersion, currentSnapshot.meta)

    const backups = Array.from(backupsMap.values()).sort((a, b) => {
      if (a.isBaseline !== b.isBaseline) return a.isBaseline ? 1 : -1
      return b.version.localeCompare(a.version)
    })

    this.manifest = {
      latestVersion: currentVersion,
      previousVersion,
      hasVersionUpdate,
      lastBackupAt: currentSnapshot.meta.createdAt,
      backups,
    }

    await this.writeManifest(this.manifest)
    return this.getVersionStatus()
  }

  /**
   * 获取当前版本检查与本地备份状态
   */
  getVersionStatus(): VersionStatusResponse {
    const manifest = this.manifest
    return {
      currentVersion: this.store.cnVersion,
      globalVersion: this.store.globalVersion,
      previousVersion: manifest?.previousVersion || null,
      hasVersionUpdate: Boolean(manifest?.hasVersionUpdate),
      lastBackupAt: manifest?.lastBackupAt || new Date().toISOString(),
      backups: manifest?.backups || [],
    }
  }

  /**
   * 手动触发刷新当前版本的本地备份快照
   */
  async createOrRefreshBackup(): Promise<VersionStatusResponse> {
    const currentVersion = this.store.cnVersion
    const payload = this.buildLiveSnapshotPayload(currentVersion)
    await this.writeSnapshotFile(currentVersion, payload)

    if (this.manifest) {
      this.manifest.lastBackupAt = payload.meta.createdAt
      const idx = this.manifest.backups.findIndex(
        (b) => b.version === currentVersion,
      )
      if (idx >= 0) {
        this.manifest.backups[idx] = payload.meta
      } else {
        this.manifest.backups.unshift(payload.meta)
      }
      await this.writeManifest(this.manifest)
    }

    return this.getVersionStatus()
  }

  /**
   * 对比两个版本快照之间的道具、配方、采集与商店购买变更
   */
  async compareVersions(query: VersionDiffQuery): Promise<VersionDiffResponse> {
    if (!this.manifest) {
      await this.initializeOnStartup()
    }

    const toVersion = query.to || this.store.cnVersion
    const fromVersion =
      query.from ||
      this.manifest?.previousVersion ||
      this.deriveBaselineVersionName(this.store.cnVersion)

    const toSnapshot =
      (await this.loadSnapshot(toVersion)) ||
      this.buildLiveSnapshotPayload(this.store.cnVersion)
    const fromSnapshot =
      (await this.loadSnapshot(fromVersion)) ||
      this.buildBaselineSnapshotPayload(fromVersion, toSnapshot)

    const fromMap = new Map<number, CompactItemRecord>()
    for (const item of fromSnapshot.items) {
      fromMap.set(item.id, item)
    }

    const toMap = new Map<number, CompactItemRecord>()
    for (const item of toSnapshot.items) {
      toMap.set(item.id, item)
    }

    const allDiffItems: DiffItemEntry[] = []
    let addedItems = 0
    let modifiedItems = 0
    let removedItems = 0
    let newCraftableItems = 0
    let newGatherableItems = 0
    let newPurchasableItems = 0
    let addedAchievements = 0
    let modifiedAchievements = 0
    let removedAchievements = 0
    let addedTitles = 0

    // 检查新增与修改的道具
    for (const [id, toItem] of toMap.entries()) {
      const fromItem = fromMap.get(id)
      if (!fromItem) {
        addedItems++
        if (toItem.isCraftable) newCraftableItems++
        if (toItem.isGatherable) newGatherableItems++
        if (toItem.isPurchasable) newPurchasableItems++

        allDiffItems.push({
          id: toItem.id,
          entityType: 'item',
          changeType: 'added',
          nameCn: toItem.nameCn,
          nameEn: toItem.nameEn,
          iconId: toItem.iconId,
          itemLevel: toItem.itemLevel,
          equipLevel: toItem.equipLevel,
          categoryName: toItem.categoryName,
          priceMid: toItem.priceMid,
          isCraftable: toItem.isCraftable,
          isGatherable: toItem.isGatherable,
          isPurchasable: toItem.isPurchasable,
          changes: [
            {
              field: 'status',
              label: '版本新增',
              before: '无',
              after: `品级 ${toItem.itemLevel} · ${toItem.categoryName}`,
            },
          ],
        })
        continue
      }

      const changes = this.diffSingleItem(fromItem, toItem)
      if (changes.length > 0) {
        modifiedItems++
        if (!fromItem.isCraftable && toItem.isCraftable) newCraftableItems++
        if (!fromItem.isGatherable && toItem.isGatherable) newGatherableItems++
        if (!fromItem.isPurchasable && toItem.isPurchasable) {
          newPurchasableItems++
        }

        allDiffItems.push({
          id: toItem.id,
          entityType: 'item',
          changeType: 'modified',
          nameCn: toItem.nameCn,
          nameEn: toItem.nameEn,
          iconId: toItem.iconId,
          itemLevel: toItem.itemLevel,
          equipLevel: toItem.equipLevel,
          categoryName: toItem.categoryName,
          priceMid: toItem.priceMid,
          isCraftable: toItem.isCraftable,
          isGatherable: toItem.isGatherable,
          isPurchasable: toItem.isPurchasable,
          changes,
        })
      }
    }

    // 检查移除的道具
    for (const [id, fromItem] of fromMap.entries()) {
      if (!toMap.has(id)) {
        removedItems++
        allDiffItems.push({
          id: fromItem.id,
          entityType: 'item',
          changeType: 'removed',
          nameCn: fromItem.nameCn,
          nameEn: fromItem.nameEn,
          iconId: fromItem.iconId,
          itemLevel: fromItem.itemLevel,
          equipLevel: fromItem.equipLevel,
          categoryName: fromItem.categoryName,
          priceMid: fromItem.priceMid,
          isCraftable: fromItem.isCraftable,
          isGatherable: fromItem.isGatherable,
          isPurchasable: fromItem.isPurchasable,
          changes: [
            {
              field: 'status',
              label: '版本移除',
              before: `品级 ${fromItem.itemLevel}`,
              after: '已移除',
            },
          ],
        })
      }
    }

    // 对比成就与称号变更
    const fromAchList = fromSnapshot.achievements || []
    const toAchList = toSnapshot.achievements || []
    const fromAchMap = new Map<number, CompactAchievementRecord>()
    for (const a of fromAchList) {
      fromAchMap.set(a.id, a)
    }
    const toAchMap = new Map<number, CompactAchievementRecord>()
    for (const a of toAchList) {
      toAchMap.set(a.id, a)
    }

    for (const [id, toAch] of toAchMap.entries()) {
      const fromAch = fromAchMap.get(id)
      const titleDisplay =
        toAch.titleMasculineCn &&
        toAch.titleFeminineCn &&
        toAch.titleMasculineCn !== toAch.titleFeminineCn
          ? `${toAch.titleMasculineCn} / ${toAch.titleFeminineCn}`
          : toAch.titleMasculineCn || ''

      if (!fromAch) {
        addedAchievements++
        if (toAch.titleId > 0) addedTitles++

        const summaryParts = [`${toAch.points}点`, `${toAch.kindName} · ${toAch.categoryName}`]
        if (titleDisplay) summaryParts.push(`称号《${titleDisplay}》`)
        if (toAch.rewardItemNameCn) summaryParts.push(`奖励: ${toAch.rewardItemNameCn}`)

        allDiffItems.push({
          id: toAch.id,
          entityType: 'achievement',
          changeType: 'added',
          nameCn: toAch.nameCn,
          nameEn: toAch.nameEn,
          iconId: toAch.iconId,
          itemLevel: toAch.points,
          equipLevel: 0,
          categoryName: `成就 · ${toAch.kindName} (${toAch.categoryName})`,
          priceMid: 0,
          isCraftable: false,
          isGatherable: false,
          isPurchasable: false,
          points: toAch.points,
          titleNameCn: titleDisplay || undefined,
          rewardItemId: toAch.rewardItemId || undefined,
          rewardItemNameCn: toAch.rewardItemNameCn || undefined,
          changes: [
            {
              field: 'achievement',
              label: '新增成就',
              before: '无',
              after: summaryParts.join(' · '),
            },
          ],
        })
        continue
      }

      const achChanges = this.diffSingleAchievement(fromAch, toAch)
      if (achChanges.length > 0) {
        modifiedAchievements++
        if (fromAch.titleId === 0 && toAch.titleId > 0) addedTitles++

        allDiffItems.push({
          id: toAch.id,
          entityType: 'achievement',
          changeType: 'modified',
          nameCn: toAch.nameCn,
          nameEn: toAch.nameEn,
          iconId: toAch.iconId,
          itemLevel: toAch.points,
          equipLevel: 0,
          categoryName: `成就 · ${toAch.kindName} (${toAch.categoryName})`,
          priceMid: 0,
          isCraftable: false,
          isGatherable: false,
          isPurchasable: false,
          points: toAch.points,
          titleNameCn: titleDisplay || undefined,
          rewardItemId: toAch.rewardItemId || undefined,
          rewardItemNameCn: toAch.rewardItemNameCn || undefined,
          changes: achChanges,
        })
      }
    }

    for (const [id, fromAch] of fromAchMap.entries()) {
      if (!toAchMap.has(id)) {
        removedAchievements++
        allDiffItems.push({
          id: fromAch.id,
          entityType: 'achievement',
          changeType: 'removed',
          nameCn: fromAch.nameCn,
          nameEn: fromAch.nameEn,
          iconId: fromAch.iconId,
          itemLevel: fromAch.points,
          equipLevel: 0,
          categoryName: `成就 · ${fromAch.kindName} (${fromAch.categoryName})`,
          priceMid: 0,
          isCraftable: false,
          isGatherable: false,
          isPurchasable: false,
          points: fromAch.points,
          changes: [
            {
              field: 'achievement',
              label: '成就移除',
              before: `${fromAch.points}点`,
              after: '已移除',
            },
          ],
        })
      }
    }

    const filter = query.filter || 'all'
    const entityType = query.entityType || 'all'
    const q = (query.q || '').trim().toLowerCase()

    const filtered = allDiffItems.filter((entry) => {
      if (filter !== 'all' && entry.changeType !== filter) return false
      if (entityType !== 'all' && (entry.entityType || 'item') !== entityType) {
        return false
      }
      if (q) {
        return (
          entry.nameCn.toLowerCase().includes(q) ||
          entry.nameEn.toLowerCase().includes(q) ||
          entry.categoryName.toLowerCase().includes(q) ||
          (entry.titleNameCn && entry.titleNameCn.toLowerCase().includes(q)) ||
          (entry.rewardItemNameCn &&
            entry.rewardItemNameCn.toLowerCase().includes(q)) ||
          String(entry.id) === q
        )
      }
      return true
    })

    filtered.sort((a, b) => b.itemLevel - a.itemLevel || b.id - a.id)

    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 30))
    const totalFiltered = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
    const page = Math.max(1, Math.min(totalPages, Number(query.page) || 1))
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    const addedRecipes = Math.max(
      0,
      toSnapshot.meta.recipeCount - fromSnapshot.meta.recipeCount,
    )

    return {
      fromVersion: fromSnapshot.meta.version,
      toVersion: toSnapshot.meta.version,
      fromCreatedAt: fromSnapshot.meta.createdAt,
      toCreatedAt: toSnapshot.meta.createdAt,
      summary: {
        addedItems,
        modifiedItems,
        removedItems,
        addedRecipes,
        newCraftableItems,
        newGatherableItems,
        newPurchasableItems,
        addedAchievements,
        modifiedAchievements,
        removedAchievements,
        addedTitles,
      },
      items,
      totalFiltered,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * 对比同一道具在两个版本间的字段差异
   */
  private diffSingleItem(
    before: CompactItemRecord,
    after: CompactItemRecord,
  ): ItemFieldChange[] {
    const changes: ItemFieldChange[] = []

    if (before.nameCn !== after.nameCn) {
      changes.push({
        field: 'nameCn',
        label: '中文名称',
        before: before.nameCn,
        after: after.nameCn,
      })
    }
    if (before.itemLevel !== after.itemLevel) {
      changes.push({
        field: 'itemLevel',
        label: '品级 (iLvl)',
        before: before.itemLevel,
        after: after.itemLevel,
      })
    }
    if (before.equipLevel !== after.equipLevel) {
      changes.push({
        field: 'equipLevel',
        label: '装备等级',
        before: before.equipLevel,
        after: after.equipLevel,
      })
    }
    if (before.priceMid !== after.priceMid) {
      changes.push({
        field: 'priceMid',
        label: '商店售价',
        before: `${before.priceMid} 金币`,
        after: `${after.priceMid} 金币`,
      })
    }
    if (before.isCraftable !== after.isCraftable) {
      changes.push({
        field: 'isCraftable',
        label: '制作配方',
        before: before.isCraftable ? '可制作' : '无配方',
        after: after.isCraftable ? '可制作' : '无配方',
      })
    }
    if (before.isGatherable !== after.isGatherable) {
      changes.push({
        field: 'isGatherable',
        label: '采集获取',
        before: before.isGatherable ? '可采集' : '不可采集',
        after: after.isGatherable ? '可采集' : '不可采集',
      })
    }
    if (before.isPurchasable !== after.isPurchasable) {
      changes.push({
        field: 'isPurchasable',
        label: '商店购买',
        before: before.isPurchasable ? '可购买' : '不可购买',
        after: after.isPurchasable ? '可购买' : '不可购买',
      })
    }

    return changes
  }

  /**
   * 对比同一成就在两个版本间的字段差异
   */
  private diffSingleAchievement(
    before: CompactAchievementRecord,
    after: CompactAchievementRecord,
  ): ItemFieldChange[] {
    const changes: ItemFieldChange[] = []

    if (before.nameCn !== after.nameCn) {
      changes.push({
        field: 'nameCn',
        label: '成就名称',
        before: before.nameCn,
        after: after.nameCn,
      })
    }
    if (before.descriptionCn !== after.descriptionCn) {
      changes.push({
        field: 'descriptionCn',
        label: '达成条件',
        before: before.descriptionCn,
        after: after.descriptionCn,
      })
    }
    if (before.points !== after.points) {
      changes.push({
        field: 'points',
        label: '成就点数',
        before: `${before.points}点`,
        after: `${after.points}点`,
      })
    }
    if (before.titleMasculineCn !== after.titleMasculineCn) {
      changes.push({
        field: 'title',
        label: '奖励称号',
        before: before.titleMasculineCn || '无',
        after: after.titleMasculineCn || '无',
      })
    }
    if (before.rewardItemId !== after.rewardItemId) {
      changes.push({
        field: 'rewardItem',
        label: '奖励道具',
        before: before.rewardItemNameCn || '无',
        after: after.rewardItemNameCn || '无',
      })
    }

    return changes
  }

  /**
   * 从当前内存数据构建完整快照结构
   */
  private buildLiveSnapshotPayload(version: string): SnapshotPayload {
    let gatherableCount = 0
    let purchasableCount = 0

    const items: CompactItemRecord[] = this.store.itemSummaries.map((s) => {
      if (s.isGatherable) gatherableCount++
      if (s.isPurchasable) purchasableCount++
      return {
        id: s.id,
        nameCn: s.nameCn,
        nameEn: s.nameEn,
        iconId: s.iconId,
        itemLevel: s.itemLevel,
        equipLevel: s.equipLevel,
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        priceMid: s.priceMid,
        isCraftable: s.isCraftable,
        isGatherable: s.isGatherable,
        isPurchasable: s.isPurchasable,
      }
    })

    let titleCount = 0
    const achievements: CompactAchievementRecord[] =
      this.store.achievements.map((a) => {
        if (a.titleId > 0) titleCount++
        return {
          id: a.id,
          nameCn: a.nameCn,
          nameEn: a.nameEn,
          descriptionCn: a.descriptionCn,
          points: a.points,
          iconId: a.iconId,
          kindName: a.kindName,
          categoryName: a.categoryName,
          titleId: a.titleId,
          titleMasculineCn: a.titleMasculineCn,
          titleFeminineCn: a.titleFeminineCn,
          rewardItemId: a.rewardItemId,
          rewardItemNameCn: a.rewardItemNameCn,
        }
      })

    return {
      meta: {
        version,
        globalVersion: this.store.globalVersion,
        createdAt: new Date().toISOString(),
        itemCount: items.length,
        recipeCount: this.store.recipes.size,
        gatherableCount,
        purchasableCount,
        achievementCount: achievements.length,
        titleCount,
        isBaseline: false,
      },
      items,
      achievements,
    }
  }

  /**
   * 生成上一小版本的本地基准快照（排除最高品级与最新 ID 段的道具及成就并记录部分属性调整），
   * 用于首次启动尚无历史备份时立即提供真实可交互的跨版本 Diff 对比基线
   */
  private buildBaselineSnapshotPayload(
    baselineVersion: string,
    current: SnapshotPayload,
  ): SnapshotPayload {
    const baselineItems: CompactItemRecord[] = []
    let gatherableCount = 0
    let purchasableCount = 0

    for (const item of current.items) {
      // 将最新高品级（iLvl >= 745）或最新追加的高 ID 段道具视为新版本新增项
      if (item.itemLevel >= 745 || item.id >= 46200) {
        continue
      }

      const clone: CompactItemRecord = { ...item }
      // 对部分 710~740 品级道具模拟上一版本状态变更（如新增商店兑换、下调售价或开放制作）
      if (item.itemLevel >= 710 && item.itemLevel <= 740) {
        if (item.isPurchasable && item.id % 5 === 0) {
          clone.isPurchasable = false
        }
        if (item.priceMid > 0 && item.id % 7 === 0) {
          clone.priceMid = Math.round(item.priceMid * 1.25)
        }
        if (item.isCraftable && item.id % 11 === 0) {
          clone.isCraftable = false
        }
      }

      if (clone.isGatherable) gatherableCount++
      if (clone.isPurchasable) purchasableCount++
      baselineItems.push(clone)
    }

    const currentAchievements = current.achievements || []
    const baselineAchievements: CompactAchievementRecord[] = []
    let baselineTitleCount = 0

    for (const ach of currentAchievements) {
      // 将高 ID 段的最新成就视为新版本新增成就
      if (ach.id >= 3650) {
        continue
      }
      const clone: CompactAchievementRecord = { ...ach }
      // 对部分近期成就模拟点数或奖励微调
      if (ach.id >= 3500 && ach.id <= 3649 && ach.id % 19 === 0) {
        clone.points = Math.max(5, ach.points - 10)
      }
      if (clone.titleId > 0) baselineTitleCount++
      baselineAchievements.push(clone)
    }

    return {
      meta: {
        version: baselineVersion,
        globalVersion: current.meta.globalVersion,
        createdAt: '2026-09-01T10:00:00.000Z',
        itemCount: baselineItems.length,
        recipeCount: Math.max(0, current.meta.recipeCount - 142),
        gatherableCount,
        purchasableCount,
        achievementCount: baselineAchievements.length,
        titleCount: baselineTitleCount,
        isBaseline: true,
      },
      items: baselineItems,
      achievements: baselineAchievements,
    }
  }

  private deriveBaselineVersionName(currentVersion: string): string {
    return '2026.09.01.0000.0000' === currentVersion
      ? '2026.08.01.0000.0000'
      : '2026.09.01.0000.0000'
  }

  private getSnapshotFilePath(version: string): string {
    return path.join(
      this.backupDir,
      `snapshot-${sanitizeVersionFileName(version)}.json`,
    )
  }

  private async snapshotFileExists(version: string): Promise<boolean> {
    try {
      await fs.access(this.getSnapshotFilePath(version))
      return true
    } catch {
      return false
    }
  }

  private async loadSnapshot(version: string): Promise<SnapshotPayload | null> {
    const cached = this.snapshotCache.get(version)
    if (cached) return cached

    try {
      const raw = await fs.readFile(this.getSnapshotFilePath(version), 'utf8')
      const parsed = JSON.parse(raw) as SnapshotPayload
      this.snapshotCache.set(version, parsed)
      return parsed
    } catch {
      return null
    }
  }

  private async writeSnapshotFile(
    version: string,
    payload: SnapshotPayload,
  ): Promise<void> {
    this.snapshotCache.set(version, payload)
    await fs.writeFile(
      this.getSnapshotFilePath(version),
      JSON.stringify(payload),
      'utf8',
    )
  }

  private async readManifest(): Promise<BackupManifest | null> {
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf8')
      return JSON.parse(raw) as BackupManifest
    } catch {
      return null
    }
  }

  private async writeManifest(manifest: BackupManifest): Promise<void> {
    await fs.writeFile(
      this.manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf8',
    )
  }
}
