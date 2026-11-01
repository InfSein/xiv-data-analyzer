import { accessSync, constants as fsConstants, existsSync, readFileSync } from 'node:fs'
import { access, constants, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/**
 * 本地 FF14 游戏路径配置（严格只读，禁止任何写入操作）
 */
export interface GamePathsConfig {
  cnRootPath: string
  cnGamePath: string
  globalRootPath: string
  globalGamePath: string
}

export interface LoadEnvOptions {
  envFilePath?: string
  env?: Record<string, string | undefined>
  ignoreDotEnvFile?: boolean
}

/**
 * 解析 UTF-8 编码的 .env 文件内容为键值对字典
 */
export function parseDotEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const cleanContent = content.replace(/^\uFEFF/, '')

  for (const rawLine of cleanContent.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let val = line.slice(eqIndex + 1).trim()

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }

    if (key) {
      result[key] = val
    }
  }

  return result
}

/**
 * 从 .env 文件与环境变量加载并校验本地 FF14 国服与国际服路径配置
 * 若未提供足够的路径信息，立即抛出明确错误
 */
export function loadGamePathsFromEnv(
  options: LoadEnvOptions = {},
): GamePathsConfig {
  const envFilePath = options.envFilePath || resolve(process.cwd(), '.env')
  const fileVars: Record<string, string> = {}

  if (!options.ignoreDotEnvFile && existsSync(envFilePath)) {
    const raw = readFileSync(envFilePath, 'utf8')
    Object.assign(fileVars, parseDotEnvContent(raw))
  }

  const runtimeEnv = options.env ?? process.env
  const cnRootPath = (
    runtimeEnv.FFXIV_CN_PATH ??
    fileVars.FFXIV_CN_PATH ??
    ''
  ).trim()
  const globalRootPath = (
    runtimeEnv.FFXIV_GLOBAL_PATH ??
    fileVars.FFXIV_GLOBAL_PATH ??
    ''
  ).trim()

  const missingKeys: string[] = []
  if (!cnRootPath) missingKeys.push('FFXIV_CN_PATH (国服客户端路径)')
  if (!globalRootPath) missingKeys.push('FFXIV_GLOBAL_PATH (国际服客户端路径)')

  if (missingKeys.length > 0) {
    throw new Error(
      `[配置错误] 未提供完整的本地 FF14 游戏路径配置，缺少: ${missingKeys.join('、')}。请参考项目根目录下的 .env.example 创建 .env 文件并配置正确的路径。`,
    )
  }

  return {
    cnRootPath,
    cnGamePath: join(cnRootPath, 'game'),
    globalRootPath,
    globalGamePath: join(globalRootPath, 'game'),
  }
}

/**
 * 启动时同步校验配置完整性与游戏 sqpack 目录可读性
 * 用于开发服务器 (npm run dev) 或生产服务启动阶段的快速失败检查
 */
export function validateGamePathsOnStartup(
  options: LoadEnvOptions = {},
): GamePathsConfig {
  const config = loadGamePathsFromEnv(options)

  try {
    accessSync(join(config.cnGamePath, 'sqpack'), fsConstants.R_OK)
  } catch {
    throw new Error(
      `[配置错误] 国服路径无效或无法读取 sqpack 数据目录: "${join(config.cnGamePath, 'sqpack')}"。请检查 .env 中的 FFXIV_CN_PATH 配置。`,
    )
  }

  try {
    accessSync(join(config.globalGamePath, 'sqpack'), fsConstants.R_OK)
  } catch {
    throw new Error(
      `[配置错误] 国际服路径无效或无法读取 sqpack 数据目录: "${join(config.globalGamePath, 'sqpack')}"。请检查 .env 中的 FFXIV_GLOBAL_PATH 配置。`,
    )
  }

  return config
}

/**
 * 校验游戏目录是否可读并读取客户端版本号（仅执行只读检查）
 */
export async function verifyAndReadGameVersions(
  config?: GamePathsConfig,
): Promise<{ cnVersion: string; globalVersion: string }> {
  const resolvedConfig = config ?? loadGamePathsFromEnv()

  try {
    await access(join(resolvedConfig.cnGamePath, 'sqpack'), constants.R_OK)
  } catch {
    throw new Error(
      `[配置错误] 国服路径无效或无法读取 sqpack 目录: ${join(resolvedConfig.cnGamePath, 'sqpack')}`,
    )
  }

  try {
    await access(join(resolvedConfig.globalGamePath, 'sqpack'), constants.R_OK)
  } catch {
    throw new Error(
      `[配置错误] 国际服路径无效或无法读取 sqpack 目录: ${join(resolvedConfig.globalGamePath, 'sqpack')}`,
    )
  }

  const [cnVerRaw, globalVerRaw] = await Promise.all([
    readFile(join(resolvedConfig.cnGamePath, 'ffxivgame.ver'), 'utf8').catch(
      () => '未知版本',
    ),
    readFile(
      join(resolvedConfig.globalGamePath, 'ffxivgame.ver'),
      'utf8',
    ).catch(() => '未知版本'),
  ])

  return {
    cnVersion: cnVerRaw.trim(),
    globalVersion: globalVerRaw.trim(),
  }
}
