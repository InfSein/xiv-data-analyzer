import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { createApiApp, getSharedGameDataService } from './app'
import { validateGamePathsOnStartup } from './config'

const PORT = Number(process.env.PORT) || 3000

async function startServer() {
  // 启动时首先校验 .env 中的本地 FF14 游戏路径配置是否完整可读
  validateGamePathsOnStartup()

  // 预热加载本地 FF14 游戏数据
  await getSharedGameDataService()

  const app = createApiApp()
  const distPath = resolve(process.cwd(), 'dist')

  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next()
        return
      }
      res.sendFile(resolve(distPath, 'index.html'))
    })
  }

  app.listen(PORT, () => {
    console.log(
      `[Server] FF14 本地数据查询服务已启动: http://localhost:${PORT}`,
    )
  })
}

startServer().catch((err) => {
  console.error('[Server] 服务启动异常:', err)
  process.exit(1)
})
