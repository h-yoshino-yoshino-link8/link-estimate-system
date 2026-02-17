# App Layer (MVP)

## Structure

- `api/`: FastAPI backend
- `web/`: Next.js frontend

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
