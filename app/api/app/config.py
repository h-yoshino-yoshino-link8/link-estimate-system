"""Runtime configuration for API service."""

from __future__ import annotations

import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = API_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


DEFAULT_DATABASE_URL = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
DATABASE_URL = os.getenv("APP_DATABASE_URL", DEFAULT_DATABASE_URL)
CORS_ORIGINS = [x.strip() for x in os.getenv("APP_CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]

DEFAULT_EXCEL_SOURCE_PATH = (API_ROOT.parents[1] / "excel" / "見積原価管理システム.xlsm").as_posix()
EXCEL_SOURCE_PATH = os.getenv("APP_EXCEL_SOURCE_PATH", DEFAULT_EXCEL_SOURCE_PATH)
WORKBOOK_BASE_DIR = Path(os.getenv("APP_WORKBOOK_BASE_DIR", (API_ROOT.parents[1] / "excel").as_posix())).expanduser().resolve()
ALLOW_CUSTOM_WORKBOOK_PATH = _as_bool(os.getenv("APP_ALLOW_CUSTOM_WORKBOOK_PATH"), default=False)
MAX_UPLOAD_BYTES = _as_int(os.getenv("APP_MAX_UPLOAD_BYTES"), default=20 * 1024 * 1024)
API_KEY = (os.getenv("APP_API_KEY") or "").strip()
