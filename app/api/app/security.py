"""Simple request security helpers."""

from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, status

from .config import API_KEY


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    """Require API key only when APP_API_KEY is configured."""
    if not API_KEY:
        return
    if x_api_key != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
