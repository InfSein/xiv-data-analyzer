# ARCHITECTURE.md — 项目架构说明

## 1. 模块与文件职责

| 文件路径 | 职责说明 |
| --- | --- |
| `.env.example` / `.env` | 本地国服 (`FFXIV_CN_PATH`) 与国际服 (`FFXIV_GLOBAL_PATH`) 客户端路径环境变量配置模板与实际配置。 |
| `AGENTS.md` | 项目开发安全红线与基于 `Leonxlnx/taste-skill` (`framed-sheet`) 总结的 To-B UI 设计规范准则。 |
| `src/shared/types.ts` | 定义前后端共享的数据模型与接口类型（道具摘要、详情、装备与药效参数、制作配方树、采集钓场、NPC 商店兑换、版本备份与 Diff 结构）。 |
| `src/server/config.ts` | 从 `.env` 读取本地国服与国际服 FF14 客户端路径配置，在启动阶段强制校验路径完整性与 `game/sqpack` 只读权限，并读取客户端版本号。 |
| `src/server/sqpack-helper.ts` | 封装 `@ffcafe/elpis-sqpack`、`@ffcafe/elpis-sestring` 与 `@ffcafe/elpis-texture`，负责 EXH/EXD 数据表读取、SeString 文本解码以及 `.tex` 图标/地图贴图的 PNG 转换与内存缓存。 |
| `src/server/shop-loader.ts` | 解析 `GilShop`、`GilShopItem`、`SpecialShop`、`GCScripShopItem`、`FccShop`、`TomestonesItem` 并递归追踪 `ENpcBase` / `TopicSelect` / `PreHandler` / `InclusionShop` / `CustomTalk` 与 `Level` 表，构建道具到售卖 NPC 与地图坐标的反向索引。 |
| `src/server/data-loader.ts` | 并行读取国服与国际服中的核心数据表（Item、Recipe、Gathering、Fishing、Shop、NPC、Map 等），在内存中构建全量正反向关联索引。 |
| `src/server/game-data-service.ts` | 业务逻辑核心层，提供多语言模糊/精确搜索、多维度过滤、装备与药食数值计算、NPC 商店与商人坐标聚合、递归配方原料树构建及 3D/2D 地图坐标换算。 |
| `src/server/version-backup.ts` | 客户端版本检查与本地快照备份服务，每次启动校验 `ffxivgame.ver`，在 `data/backups/` 下维护版本快照并提供跨版本 Diff 对比计算。 |
| `src/server/app.ts` | Express API 路由定义层，对外提供 `/api/status`、`/api/version/status`、`/api/version/backup`、`/api/version/diff`、`/api/items`、`/api/items/:id`、`/api/icon/:iconId`、`/api/map` 等接口。 |
| `src/server/index.ts` | 独立生产环境服务端入口，预热加载游戏数据并执行版本备份检查，同时托管 API 与前端静态产物。 |
| `vite.config.ts` | Vite 构建与开发服务器配置，通过自定义插件将 Express API 直接挂载至开发服务器中间件，实现单端口前后端一体运行。 |
| `src/client/index.css` | 定义 `framed-sheet` To-B 视觉令牌、L 型外框与内嵌白底工作台网格、四栏分割 KPI 样式、扁平胶囊标签与 `tabular-nums` 等宽数字对齐规则。 |
| `src/client/api.ts` | 前端网络请求封装（含道具检索、详情、版本检查与 Diff 对比）及本地图标/地图资源 URL 生成器。 |
| `src/client/utils/eorzea-time.ts` | 艾欧泽亚时间 (ET) 实时换算器与限时采集点开放状态、现实剩余秒数计算工具。 |
| `src/client/App.tsx` | 前端顶层工作台容器，协调左侧导航栏、顶部检索框、版本更新提示横幅、道具主从工作台与版本 Diff 对比视图。 |
| `src/client/components/Header.tsx` | L 型外框导航组件（左侧 `228px` 导航栏 + 顶部 `48px` 快捷检索栏），包含工作区模块切换、数据途径视图、八大巧匠职业过滤与实时 ET 时钟。 |
| `src/client/components/SearchFilterBar.tsx` | 工作台顶部四栏分割 KPI 统计带与多条件紧凑筛选工具栏。 |
| `src/client/components/ItemList.tsx` | 左侧分页道具主从列表，展示图标、名称、等宽右对齐 ID/品级与配方/采集/商店胶囊标签。 |
| `src/client/components/ItemDetail.tsx` | 右侧道具详情主面板，支持 NQ/HQ 品质分段切换，展示基础信息、装备词条、食品药效，并串联商店、配方与采集子模块。 |
| `src/client/components/ShopSection.tsx` | NPC 商店购买与特殊货币兑换明细表，展示商店类型、产出数量、所需货币/道具（支持点击跳转）及售卖 NPC 所在区域与地图坐标。 |
| `src/client/components/RecipeSection.tsx` | 制作配方模块，支持多职业配方切换、工匠属性要求展示、批量制作次数计算器、底层原始素材自动汇总、递归工序树及作为原料的下游配方查询。 |
| `src/client/components/GatheringSection.tsx` | 采集与捕鱼模块，展示采矿/园艺采集点、限时/精选节点实时倒计时、传承录要求、捕鱼人钓场与刺鱼渔场详情。 |
| `src/client/components/VersionDiffView.tsx` | 客户端版本变更对比视图，支持选择任意两个本地备份快照，按全部/新增/变更/移除筛选并展示字段级 `变更前 -> 变更后` 对比表。 |
| `src/client/components/MapModal.tsx` | 交互式游戏原生地贴图预览弹窗，加载本地客户端解码的地图贴图并精确标注 NPC 商人或采集/垂钓坐标。 |
| `test/data-service.test.ts` | 针对本地真实游戏数据解析、NPC 商店购买链路、版本快照备份与跨版本 Diff 对比的自动化测试。 |

---

## 2. 模块间调用关系

```
[本地 FF14 客户端 SqPack (国服 & 国际服 - 严格只读)]
        │
        ▼ (@ffcafe/elpis-sqpack, @ffcafe/elpis-sestring, @ffcafe/elpis-texture)
[src/server/sqpack-helper.ts] ──(读取 EXH/EXD & 解码 .tex)
        │
        ├──► [src/server/shop-loader.ts] ──(解析 GilShop / SpecialShop / ENpc / Level 关联)
        ▼
[src/server/data-loader.ts] ────(构建内存表与正反向索引 LoadedGameStore)
        │
        ├──► [src/server/game-data-service.ts] ──(搜索、商店兑换、配方树递归、坐标转换)
        └──► [src/server/version-backup.ts] ─────(启动版本检查、data/backups/ 快照读写与版本 Diff)
                    │
                    ▼
            [src/server/app.ts] ────────────(暴露 /api/* HTTP 接口)
                    │
                    ▼ (HTTP JSON / PNG Stream)
            [src/client/api.ts]
                    │
                    ▼
            [src/client/App.tsx] (Framed-Sheet Shell)
              ├─► [Header.tsx] ──────────────(L型外框：左侧导航 + 顶部检索 + 实时 ET 时钟)
              ├─► [VersionDiffView.tsx] ─────(版本快照选择、统计 KPI 与字段级 Diff 表)
              ├─► [SearchFilterBar.tsx] ─────(四栏分割 KPI 统计带 + 紧凑筛选栏)
              ├─► [ItemList.tsx]
              ├─► [ItemDetail.tsx]
              │     ├─► [ShopSection.tsx] ──────(NPC 商店与货币兑换明细表 + 商人地图定位)
              │     ├─► [RecipeSection.tsx]
              │     └─► [GatheringSection.tsx] ─(调用 eorzea-time.ts 评估限时采集窗口)
              └─► [MapModal.tsx]
```

---

## 3. 关键设计决定与原因

1. **严格只读访问本地游戏文件**：
   - 底层仅通过 `@ffcafe/elpis-sqpack` 的 `GameSqPackReader` 读取国服 (`D:\Final Fantasy\CN\最终幻想XIV`) 和国际服 (`D:\Final Fantasy\GLOBAL\Game`) 数据，在 `config.ts` 中仅执行 `R_OK` 校验；所有版本快照均保存在项目自身 `data/backups/` 目录下，从根本上杜绝任何修改客户端文件的可能。
2. **基于 `taste-skill` (`framed-sheet`) 的现代 To-B 工作台设计**：
   - 摒弃高饱和度游戏幻想风的渐变、发光、毛玻璃与厚重阴影，采用 `#f9fbfc` 一体式 L 型外框嵌套 `#ffffff` 圆角主画布（`1px solid #e8eaec` 边框），全面启用 `tabular-nums` 等宽数字对齐与 `1px` 分割线，并将全套设计准则固化于 `AGENTS.md`。
3. **多跳引用链解析 NPC 商店与商人世界坐标**：
   - FF14 中 NPC 与商店不仅通过 `ENpcBase` 直接绑定，还大量通过 `TopicSelect`、`PreHandler`、`InclusionShop -> InclusionShopCategory -> InclusionShopSeries` 以及 `CustomTalk` 间接挂载。`shop-loader.ts` 通过递归记忆化解析器打通完整引用链，并结合 `Level` 表 (`Type=8`) 的 3D 世界坐标与 `Map` 参数换算为精确的 2D 地图坐标。
4. **启动自动版本检查与本地快照 Diff 机制**：
   - 每次启动服务时自动对比 `ffxivgame.ver` 与 `data/backups/manifest.json`，若检测到版本更新则自动生成新快照并置位 `hasVersionUpdate`，同时维护历史基准快照，确保用户随时可在前端可视化对比任意两版之间的新增道具、配方与属性/售价变更。
