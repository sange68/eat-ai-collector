# Eat AI Collector

軟體 1：飲食資料收集後台（FastAPI + React + Python 爬蟲）

## 功能（MVP）

- 登入（admin / reviewer / contributor 角色骨架）
- 儀表板：品項數、待審數、信心分布
- URL 工作台：貼網址爬取、品牌模板一鍵更新
- 審核佇列：通過 / 退回 → 寫入 `menu_items`
- 爬蟲：iCook 食譜、Subway 台灣營養頁

## 本機開發

### 1. 後端

```bash
cd eat-ai-collector
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server.api.main:app --reload --port 8000
```

預設帳號：`admin@eat-ai.local` / `changeme`

### 2. 前端

```bash
cd admin
npm install
npm run dev
```

開啟 http://localhost:5173

## Supabase 設定

1. 在 Supabase SQL Editor 執行 `supabase/migrations/001_initial.sql`
2. 複製 Database URL 到 Railway / 本機 `.env` 的 `DATABASE_URL`

## Railway 一鍵部署

1. 將此資料夾推送到 GitHub
2. Railway → New Project → Deploy from GitHub → 選此 repo
3. 設定環境變數（見 `.env.example`）：
   - `DATABASE_URL`（Supabase）
   - `JWT_SECRET`（隨機長字串）
   - `ADMIN_PASSWORD`（改預設密碼）
   - `CORS_ORIGINS`（你的 Railway 網址）
4. Deploy 完成後開啟 `https://xxx.up.railway.app`

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/health` | 健康檢查 |
| POST | `/api/auth/login` | 登入 |
| GET | `/api/stats` | 資料覆蓋統計 |
| GET | `/api/items` | 品項列表 |
| POST | `/api/scrape/jobs` | 建立爬蟲任務 |
| POST | `/api/scrape/templates/{id}/run` | 一鍵更新模板 |
| GET | `/api/review/queue` | 待審佇列 |
| POST | `/api/review/{id}/approve` | 審核通過 |

## 專案結構

```
eat-ai-collector/
├── admin/           React Portal（Vite）
├── server/          FastAPI 後端
├── pipeline/        Python 爬蟲
├── supabase/        DB migration
├── Dockerfile
└── railway.toml
```
