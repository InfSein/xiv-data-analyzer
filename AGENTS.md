# 项目开发与 UI 设计准则 (AGENTS.md)

任何新增功能、页面或组件修改均须严格遵守本文件规定的数据安全红线与 To-B UI 设计规范，无需用户额外说明即可保持全站视觉与工程架构高度一致。

---

## 1. 数据安全与环境红线

1. **客户端目录配置与严格只读**：
   - 本地客户端路径统一通过项目根目录的 `.env` 文件配置（`FFXIV_CN_PATH` 与 `FFXIV_GLOBAL_PATH`，模板见 `.env.example`），禁止在源码中硬编码默认路径；启动服务时若未提供完整路径配置将立即报错。
   - 对上述目录**仅允许执行只读解析操作**，严禁写入、修改或删除任何客户端文件。
2. **本地版本快照存储位置**：
   - 启动时的客户端版本检查与本地数据快照备份统一保存在项目根目录下的 `data/backups/` 中。
3. **编码与注释**：
   - 所有源码与配置文件均使用 `UTF-8` 编码，代码注释统一使用中文，函数保持单一职责。

---

## 2. To-B UI 设计准则 (基于 `Leonxlnx/taste-skill` — `framed-sheet` 规范)

本项目采用 **Framed Sheet (Tinted L-Frame + Inset White Sheet)** 现代 To-B 数据工作台设计语言，追求高信噪比、结构清晰与克制的工程美感。

### 2.1 应用外壳与布局结构 (Shell Geometry)
- **一体式浅色外框 (`.app-shell`)**：整屏高度锁定 `100vh`，采用 `228px 1fr` 列宽与 `48px 1fr` 行高的 CSS Grid 布局，背景统一为 `--ground: #f9fbfc`。
- **左侧导航栏 (`.app-sidebar`, `228px`)** 与 **顶部检索栏 (`.app-topbar`, `48px`)**：共享 `--ground: #f9fbfc` 底色，二者之间不画分割线，形成 L 型外框。
- **内嵌白底工作台画布 (`.app-sheet`)**：位于右下主区域，距视口右侧与底部各内缩 `8px`，背景为 `--surface: #ffffff`，边框 `1px solid #e8eaec`，圆角 `16px` (`--radius-sheet`)，**无任何阴影**，内部按需滚动。

### 2.2 色彩与表面令牌 (Color & Surface Tokens)
| 语义令牌 | 色值 | 用途说明 |
| :--- | :--- | :--- |
| `--ground` | `#f9fbfc` | 应用外框底色、次级卡片底色、表头底色、表格行悬停态 |
| `--surface` | `#ffffff` | 主工作区画布、标准数据卡片、弹窗与输入框背景 |
| `--raised` | `#f4f6f8` | 弱化内嵌容器、描述文本框、属性胶囊底色 |
| `--active` | `#ebedee` | 侧边栏当前激活项、主从列表当前选中行背景 |
| `--border` | `#e8eaec` | 面板、卡片、工作台画布外框 `1px` 边线 |
| `--rule` | `#f0f1f2` | 表格行分割线、KPI 单元格竖向 `1px` 分割线 |
| `--control` | `#cdced1` | 输入框、下拉框、普通操作按钮 `1px` 边框 |
| `--text` | `#131416` | 一级正文、主标题、核心数值颜色 |
| `--muted` | `#5d5f60` | 二级说明文字、表头文字、字段名标签 |
| `--faint` | `#6b6b6b` | 三级辅助信息、编号前缀、禁用态说明 |
| `--accent` | `#1b6c80` | 品牌强调色（深青蓝），用于关键数值、坐标链接、输入框聚焦态 |
| `--primary` | `#1d1f20` | 主操作按钮背景、分段控制器 (`Segmented Control`) 激活态背景（配白字 `#ffffff`） |

### 2.3 语义状态胶囊 (`.pill`)
所有状态标识统一使用 `height: 20px`、`border-radius: 6px`、`font-size: 11px`、`font-weight: 500` 的扁平胶囊组件：
- `.pill-positive`（绿色 `#dcfae5` / `#04250e`）：可采集、可交易、版本新增、限时开放中
- `.pill-accent`（青蓝 `#e3f2f6` / `#134e5e`）：可商店购买、品级标识、特殊兑换
- `.pill-warning`（琥珀 `#fffbeb` / `#92400e`）：HQ 高品质、属性变更、需秘籍/传承录、军票商店
- `.pill-negative`（红色 `#ffedea` / `#831c1e`）：不可交易/绑定、版本移除、需专家之证
- `.pill-neutral`（中性灰 `#ebedee` / `#353736`）：可制作配方、常规分类、金币商店

### 2.4 排版与等宽数字对齐 (Typography & Tabular Numerals)
- **字体栈**：`"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`。
- **字号层级**：
  - 详情页道具主标题：`20px` (`font-weight: 600`, `letter-spacing: -0.01em`)
  - 模块/弹窗主标题：`14px ~ 16px` (`font-weight: 600`)
  - KPI 核心数值：`24px` (`font-weight: 400`, `letter-spacing: -0.02em`)
  - 列表与表格正文：`13px`
  - 表头、筛选器与次级说明：`12px`
  - 辅助胶囊与最小字号下限：`11px`（严禁出现小于 `11px` 的字号）
- **强制等宽数字 (`.num` / `data-num`)**：
  - 所有数字（ID、品级、等级、属性加成、价格、材料数量、坐标、时间、统计值）必须携带 `.num` 类名或位于 `data-num` 表格列中，强制启用 `font-variant-numeric: tabular-nums`。
  - 数据表中的数值列（ID、品级、产出数量等）必须右对齐（`text-align: right`）。

### 2.5 严格视觉禁令 (Anti-Slop House Rules)
新增或修改任何前端视图时，**严禁**出现以下破坏 To-B 简洁感的设计：
1. **严禁渐变与发光**：禁止使用 `linear-gradient`、`radial-gradient`、霓虹描边或发光效果。
2. **严禁毛玻璃 (`backdrop-blur`)**：顶栏、侧栏、弹窗遮罩均使用纯色或半透明纯色，禁止使用 `backdrop-filter`。
3. **严禁卡片常驻阴影**：禁止在卡片、列表、详情面板上添加 `box-shadow`（如 `shadow-md`、`shadow-lg`），完全依靠 `1px solid #e8eaec` 边框与底色对比界定层次。
4. **严禁 KPI 装饰图标圆圈**：顶部数据概览必须使用 `.kpi-strip` 四栏分割条（`1px` 竖线分隔，上标签下数值），禁止将每个指标做成带彩色圆形背景图标的独立小卡片。
5. **严禁花哨表格与符号**：表头禁止使用大写加宽字距，表格禁止斑马纹交替行底色，星级与状态禁止使用 `★` 或 Emoji 表情符号（统一使用如 `Lv.100 · 2星` 的规范文本）。
