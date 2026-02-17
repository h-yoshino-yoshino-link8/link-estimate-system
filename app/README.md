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
- `GET /api/v1/work-items`
- `GET /api/v1/projects/{project_id}/items`
- `POST /api/v1/projects/{project_id}/items`
- `GET /api/v1/invoices`
- `POST /api/v1/invoices`
- `GET /api/v1/payments`
- `POST /api/v1/payments`

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
