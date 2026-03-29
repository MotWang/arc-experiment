# ARC Cognitive Experiment 操作指南

本项目用于 ARC 认知实验（A/B/C 三组），支持：
- 两阶段实验流程（Stage 1, Stage 2）
- B/C 组 AI 辅助（仅 Stage 1）
- 题目难度池（低/中/高）与随机抽题
- 实验行为日志、作答结果采集与 CSV 导出

---

## 1. 环境准备

### 前置依赖
- Node.js 18+（建议 20+）
- npm

### 项目路径
- 开发与部署以 **`arc-cognitive-experiment 2-copy`** 为准（PostgreSQL + Docker + 线上说明）

---

## 2. 首次运行（本地）

在项目根目录执行：

```bash
cd "/Users/moriaty/Desktop/人机交互实验/arc-cognitive-experiment 2-copy"
npm install
```

创建 `.env`（已在 `.gitignore` 中忽略，不会提交）：

```env
GEMINI_API_KEY="你的GeminiKey"
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DBNAME"
```

本地若用 Docker Compose，可参考 `.env.example` 中的 `DATABASE_URL`。

启动：

```bash
npm run dev
```

访问：
- 实验界面：`http://localhost:3000`

---

## 3. 题库构建与更新

项目支持从 ARC-AGI 1/2 数据源构建三档题池（低/中/高）。

当你更新题库文件后，执行：

```bash
npm run build:pools
```

会生成：
- `public/arc_pool_low.json`
- `public/arc_pool_medium.json`
- `public/arc_pool_high.json`

然后重新运行 `npm run dev`。

---

## 4. 当前实验流程说明

### 分组
- Group A：无 AI
- Group B：Stage 1 有 AI，Stage 2 无 AI
- Group C：Stage 1 有 AI（苏格拉底式），Stage 2 无 AI

### Stage 配置
- 总共 2 个 Stage
- 每个 Stage 12 题
- 难度顺序固定：4 题低难度 -> 4 题中难度 -> 4 题高难度

---

## 5. 如何查看完成者数据

实验数据存储在：
- PostgreSQL（推荐，线上多人并发）
- 如仅本地旧版可见 `experiment.db`（已不建议用于线上）

同时提供 HTTP 接口查看：

### 5.1 作答结果（sessions）
- 全部：`http://localhost:3000/api/results`
- 指定用户：`http://localhost:3000/api/results?user_id=<USER_ID>`

返回包含：
- `task_id`, `phase`, `stage_type`, `stage_label`
- `group_type`, `task_index_in_stage`
- `metrics`（正确率、耗时、点击、信心等）
- `final_grid_snapshot`

### 5.2 行为日志（telemetry）
- 全部：`http://localhost:3000/api/telemetry`
- 指定用户：`http://localhost:3000/api/telemetry?user_id=<USER_ID>`

返回包含：
- 事件流 `events`
- 鼠标轨迹 `mouse_trace`

### 5.3 CSV 导出（可直接进 SPSS / R）
- 全部：`http://localhost:3000/api/export.csv`
- 按用户：`http://localhost:3000/api/export.csv?user_id=<USER_ID>`
- 按组别：`http://localhost:3000/api/export.csv?group_type=B`
- 按阶段类型：`http://localhost:3000/api/export.csv?stage_type=learning`

---

## 6. 调试接口

- 当前 stage 抽题快照：`http://localhost:3000/api/stage-debug`
  - 可看到每个 Stage 的 `task_id + difficulty + complexity`
- 合并题源检查：`http://localhost:3000/api/arc-pool`

---

## 7. 常见问题

### Q1: `tsx: command not found`
先执行：

```bash
npm install
```

### Q2: `Missing script: dev`
你可能不在项目目录，先 `cd` 到项目根目录（注意路径空格需要引号）。

### Q3: AI 助手显示“暂时不可用”
检查：
1. `.env` 是否存在并包含 `GEMINI_API_KEY`
2. 是否已重启 `npm run dev`
3. 访问 `http://localhost:3000/api/ai-help` 是否可达（前端会调用该接口）

### Q4: 页面提示 stage 准备失败
先重建题池并重启：

```bash
npm run build:pools
npm run dev
```

---

## 8. 建议的实验执行步骤（简版）

1. 启动服务：`npm run dev`
2. 选择组别（A/B/C）
3. 完成 Stage 1 与 Stage 2
4. 用 `/api/results` 或 `/api/export.csv` 导出数据
5. 归档导出 CSV 与 PostgreSQL 备份

---

## 9. Docker 一键启动（App + Postgres + Metabase）

### 9.1 准备环境变量

创建 `.env`（不要提交到 Git）：

```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/arc_experiment"
```

### 9.2 启动

```bash
docker compose up -d --build
```

访问：
- 实验系统：`http://localhost:3000`
- Metabase 看板：`http://localhost:3001`

### 9.3 关闭

```bash
docker compose down
```

---

## 10. GitHub + 云端部署（Railway 推荐）

### 10.1 推送到 GitHub
1. 新建 **Private** 仓库，仅研究团队可访问
2. 推送 **`arc-cognitive-experiment 2-copy`** 根目录代码
3. 确认 `.env` 未提交（`.gitignore` 已忽略）

### 10.2 Railway（推荐，最省心）

1. [Railway](https://railway.app) 控制台：**New Project** → **Deploy from GitHub repo** → 选你的私有仓库
2. **Add Service** → **Database** → **PostgreSQL**，创建后打开 Postgres 服务，复制 **`DATABASE_URL`**（或 `POSTGRES_URL` 等连接串，以界面为准）
3. 在 **App（Node）服务** → **Variables** 至少配置：
   - `GEMINI_API_KEY` = 你的密钥（仅写在平台 Secrets，勿提交仓库）
   - `DATABASE_URL` = Railway Postgres 提供的连接串（通常可用「Reference」引用 Postgres 变量）
   - `NODE_ENV` = `production`
   - `PORT`：Railway 一般自动注入，可不手动填
4. **构建与启动**（二选一即可）  
   - **有根目录 `Dockerfile`（默认）**：Railway 会用 Docker 构建，镜像内已执行 `build:pools` 与 `vite build`，启动为 `npm start`（生产模式，静态 `dist` + API）。  
   - **不用 Docker、走 Nixpacks/Railpack**：在控制台设置 **Build Command**：`npm install && npm run build:pools && npm run build`；**Start Command**：`npm start`  
   仓库中的 `railway.toml` 已配置 `startCommand` 与健康检查路径 `/api/results`（可与面板合并生效）。
5. 部署成功后，在 App 服务 **Settings → Networking** 生成公网域名（如 `https://xxx.up.railway.app`），该链接即发给被试的实验地址。

### 10.3 Render（备选）

流程类似：

1. 新建 **PostgreSQL**，记下 **Internal Database URL** 或 **External** 连接串（按 Render 文档选择）
2. **New Web Service**，连接同一 GitHub 仓库
3. 环境变量同上：`GEMINI_API_KEY`、`DATABASE_URL`、`NODE_ENV=production`
4. **Build Command**：`npm install && npm run build:pools && npm run build`  
   **Start Command**：`npm start`（请勿再用 `npm run dev` 作为线上启动）

### 10.4 上线后如何取数

将 `https://你的域名` 替换为实际上线地址，例如：

| 用途 | 路径 |
|------|------|
| 原始作答 JSON | `/api/results` |
| 行为日志 JSON | `/api/telemetry` |
| CSV 导出 | `/api/export.csv` |
| 抽题调试 | `/api/stage-debug` |

示例：`https://your-app.up.railway.app/api/export.csv`

---

## 11. 数据看板（Metabase）

### 11.1 本地 Docker（已可用）

```bash
docker compose up -d
```

- 实验：`http://localhost:3000`
- Metabase：`http://localhost:3001`（适合你先搭好仪表板模板）

### 11.2 云端看板（推荐给团队）

在 **Railway** 或 **Render** 再部署一个 **Metabase** 服务（官方镜像或一键模板），**数据库**指向与实验 App **同一套 PostgreSQL**（只读账号更佳）。Dashboard 建好后，通过 Metabase 的 **仅分享只读链接** 给研究团队，勿把数据库管理口令发给被试。

### 11.3 分析问题建议

连接数据库后推荐建立这几个问题（Question）：
1. 各组完成进度（按 `group_type`, `phase`）
2. 正确率分布（`is_correct`）
3. 耗时分布（`time_spent_s`）
4. 点击次数与效率（`total_clicks`, `relative_action_efficiency`）
5. B/C 组 AI 满意度（`ai_satisfaction`）

所有图表支持筛选和导出（CSV/XLSX）。

---

## 12. 隐私与安全建议（重要）

1. **代码与仓库中不要写死**任何 API Key；只用 `.env`（本地）与平台 **Secrets / Variables**（线上）
2. GitHub 仓库保持 **Private**
3. **不向被试**提供数据库管理口令、`DATABASE_URL` 全文或 Metabase 管理账号
4. **定期轮换** `GEMINI_API_KEY`；若曾误提交密钥，立刻在 Google AI Studio 作废并换新
5. 导出或对外协作前对 CSV/JSON **脱敏**（如 participant id 映射表单独保管）
6. 对外只分享**实验前端链接**；`/api/*` 若需限制访问，应在网关或后续加鉴权（当前为研究用开放接口，请自行评估风险）
