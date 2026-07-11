#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已建立 .env，請編輯 DATABASE_URL（可選）"
fi

cd admin
if [ ! -d node_modules ]; then
  npm install
fi
npm run build
cd "$ROOT"

echo ""
echo "啟動後端："
echo "  cd $ROOT && source .venv/bin/activate && PYTHONPATH=. uvicorn server.api.main:app --host 0.0.0.0 --port 8010"
echo ""
echo "啟動前端開發（另開終端）："
echo "  cd $ROOT/admin && npm run dev"
echo ""
echo "或僅後端（已含 admin/dist）：http://localhost:8010"
