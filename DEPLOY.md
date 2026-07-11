# Railway + Supabase 部署（3 步完成）

## 步驟 1：GitHub（已完成可跳過）

Repo: https://github.com/sange68/eat-ai-collector

## 步驟 2：Supabase 資料庫

1. 打開 [Supabase Dashboard](https://supabase.com/dashboard) → 你的專案
2. SQL Editor → 貼上 `supabase/migrations/001_initial.sql` → Run
3. Settings → Database → 複製 **Connection string (URI)**（Session mode 或 Transaction mode 皆可）

## 步驟 3：Railway 部署

1. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. 選 `sange68/eat-ai-collector`
3. **Variables** 新增：

| 變數 | 值 |
|------|-----|
| `DATABASE_URL` | Supabase 連線字串 |
| `JWT_SECRET` | 隨機長字串（可用 `openssl rand -hex 32`） |
| `ADMIN_EMAIL` | 你的管理員 email |
| `ADMIN_PASSWORD` | 強密碼 |
| `CORS_ORIGINS` | `https://你的網域.up.railway.app` |

4. 等待 Deploy 完成 → 開啟 **Generate Domain**
5. 用 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 登入

## 可選：GitHub Actions 自動部署

在 GitHub repo → Settings → Secrets → `RAILWAY_TOKEN`（Railway Account Settings → Tokens）

之後 push 到 `main` 會自動部署。
