"""Runtime configuration for API service."""

from __future__ import annotations

import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = API_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DATABASE_URL = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
DATABASE_URL = os.getenv("APP_DATABASE_URL", DEFAULT_DATABASE_URL)
CORS_ORIGINS = os.getenv("APP_CORS_ORIGINS", "http://localhost:3000").split(",")

DEFAULT_EXCEL_SOURCE_PATH = (API_ROOT.parents[1] / "excel" / "見積原価管理システム.xlsm").as_posix()
EXCEL_SOURCE_PATH = os.getenv("APP_EXCEL_SOURCE_PATH", DEFAULT_EXCEL_SOURCE_PATH)
