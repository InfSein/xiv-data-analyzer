import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createApiApp, getSharedGameDataService } from './src/server/app'
import { validateGamePathsOnStartup } from './src/server/config'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'ffxiv-elpis-api-middleware',
      configureServer(server) {
        // 启动 dev 时强制检查 .env 中的本地游戏路径配置，若缺失或不可读则立即报错终止启动
        validateGamePathsOnStartup()

        // 后台预热加载本地 SqPack 数据
        getSharedGameDataService().catch((err) => {
          console.error('预加载游戏数据异常:', err)
        })
        const apiApp = createApiApp()
        server.middlewares.use(apiApp)
      },
    },
  ],
  server: {
    port: 5173,
  },
})
