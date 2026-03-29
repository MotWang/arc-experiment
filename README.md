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
- `arc-cognitive-experiment 2`

---

## 2. 首次运行（本地）

在项目根目录执行：

```bash
cd "/Users/moriaty/Desktop/人机交互实验/arc-cognitive-experiment 2"
npm install
```

创建 `.env`（已在 `.gitignore` 中忽略，不会提交）：

```env
GEMINI_API_KEY="你的GeminiKey"
```

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

## 10. GitHub 可分享部署（推荐）

### 10.1 推送到 GitHub
1. 新建私有仓库（建议 Private）
2. 推送本项目副本代码
3. 确认 `.env` 未提交（`.gitignore` 已默认忽略）

### 10.2 平台部署（Render/Railway）
1. 新建 PostgreSQL 服务
2. 新建 Web Service，绑定 GitHub 仓库
3. 设置环境变量：
   - `GEMINI_API_KEY`
   - `DATABASE_URL`（平台提供的 PostgreSQL 连接串）
   - `NODE_ENV=production`
4. 启动命令：`npm run dev`

部署成功后，将平台 URL 发给被试即可在线参与实验。

---

## 11. 数据看板（Metabase）

连接数据库后推荐建立这几个问题（Question）：
1. 各组完成进度（按 `group_type`, `phase`）
2. 正确率分布（`is_correct`）
3. 耗时分布（`time_spent_s`）
4. 点击次数与效率（`total_clicks`, `relative_action_efficiency`）
5. B/C 组 AI 满意度（`ai_satisfaction`）

所有图表支持筛选和导出（CSV/XLSX）。

---

## 12. 隐私与安全建议（重要）

1. **永远不要提交** `.env`、密钥、数据库备份文件
2. GitHub 使用私有仓库，只有研究团队成员可访问
3. 生产环境变量只在部署平台 Secrets 中配置
4. 若怀疑密钥泄露，立即在 Google AI Studio 重新生成并替换
5. 对外只分享实验链接，不分享管理接口或数据库连接信息
