# App Layer (MVP)

## Structure

- `api/`: FastAPI backend
- `web/`: Next.js frontend

## MVP Endpoints

- `GET /health`
- `GET /api/v1/customers`
- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `POST /api/v1/documents/estimate-cover`
- `POST /api/v1/documents/receipt`
- `POST /api/v1/sync/excel`
- `POST /api/v1/sync/excel/upload`
- `GET /api/v1/work-items`
- `GET /api/v1/projects/{project_id}/items`
- `POST /api/v1/projects/{project_id}/items`
- `GET /api/v1/invoices`
- `POST /api/v1/invoices`
- `PATCH /api/v1/invoices/{invoice_id}`
- `GET /api/v1/payments`
- `POST /api/v1/payments`
- `PATCH /api/v1/payments/{payment_id}`
- `GET /api/v1/dashboard/summary`

## Local Run (without Docker)

### API

```bash
cd app/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Web

```bash
cd app/web
npm install
npm run dev
```

## Docker Run

```bash
cd app
docker compose up --build
```

## Deploy (Render Blueprint)

Repository root includes `render.yaml`.

1. Render で `New +` -> `Blueprint` を選択し、この GitHub リポジトリを接続
2. `link-estimate-api` / `link-estimate-web` / `link-estimate-db` を作成
3. `link-estimate-web` のURLで動作確認

ポイント:
- Web は Next.js rewrite で API にプロキシするため、`NEXT_PUBLIC_API_BASE` は空文字のままで運用可能
- 公開環境のExcel同期は `POST /api/v1/sync/excel/upload` を使う（サーバーファイルパス指定不要）
