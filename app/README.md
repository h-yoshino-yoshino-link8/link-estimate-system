# App Layer (MVP)

## Structure

- `api/`: FastAPI backend
- `web/`: Next.js frontend

## Frontend IA (2026-02-17 redesign)

- `/`: 経営ダッシュボード（売上・前年比・未回収/未払・期限超過）
- `/projects`: 案件一覧 + 新規案件作成
- `/projects/{projectId}`: 案件ワークスペース（明細/請求/支払/消込/PDF/メール文面）
- `/finance`: 会計センター（横断消込・未入金/期限管理・領収書）※補助画面

## Runtime Fallback

- API接続に失敗した場合、Webは自動でブラウザのローカルデータモードに切り替え
- ローカルモードでも案件作成/見積/請求/支払/消込/PDF出力のUI検証が可能

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
- `GET /api/v1/dashboard/overview`

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
