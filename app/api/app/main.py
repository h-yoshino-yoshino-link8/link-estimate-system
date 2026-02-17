"""FastAPI entrypoint for link-estimate-system MVP."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import Base, SessionLocal, engine
from .routers import customers, dashboard, documents, finance, projects, sync, work_items
from .seed import seed_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Link Estimate System API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(customers.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(work_items.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
