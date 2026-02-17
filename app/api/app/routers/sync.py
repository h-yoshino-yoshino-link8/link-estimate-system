"""Excel sync endpoint."""

from __future__ import annotations

import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, HTTPException
from fastapi import File as FastAPIFile
from fastapi import UploadFile, status
from sqlalchemy.orm import Session

from ..config import (
    ALLOW_CUSTOM_WORKBOOK_PATH,
    EXCEL_SOURCE_PATH,
    MAX_UPLOAD_BYTES,
    WORKBOOK_BASE_DIR,
)
from ..database import get_db
from ..schemas import ExcelSyncRequest, ExcelSyncResponse
from ..security import require_api_key
from ..services.excel_sync import SyncResult, sync_from_workbook

router = APIRouter(prefix="/sync", tags=["sync"])


def _to_sync_response(result: SyncResult) -> ExcelSyncResponse:
    return ExcelSyncResponse(
        workbook_path=result.workbook_path,
        customers_upserted=result.customers_upserted,
        projects_upserted=result.projects_upserted,
        invoices_upserted=result.invoices_upserted,
        payments_upserted=result.payments_upserted,
        work_items_upserted=result.work_items_upserted,
    )


def _resolve_sync_source_path(requested_path: str | None) -> str:
    if not requested_path:
        return EXCEL_SOURCE_PATH

    if not ALLOW_CUSTOM_WORKBOOK_PATH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom workbook_path is disabled in this environment",
        )

    source = Path(requested_path).expanduser().resolve()
    try:
        source.relative_to(WORKBOOK_BASE_DIR)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"workbook_path must be under: {WORKBOOK_BASE_DIR}",
        ) from exc

    return source.as_posix()


@router.post("/excel", response_model=ExcelSyncResponse)
def sync_excel(
    payload: ExcelSyncRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
) -> ExcelSyncResponse:
    workbook_path = _resolve_sync_source_path(payload.workbook_path)
    try:
        result = sync_from_workbook(db, workbook_path=workbook_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return _to_sync_response(result)


@router.post("/excel/upload", response_model=ExcelSyncResponse)
async def sync_excel_upload(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
) -> ExcelSyncResponse:
    suffix = Path(file.filename or "upload.xlsx").suffix.lower()
    if suffix not in {".xlsx", ".xlsm", ".xltx", ".xltm"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension. Use .xlsx or .xlsm",
        )

    temp_path = ""
    bytes_written = 0
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp_path = temp.name
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Uploaded file too large. Max bytes: {MAX_UPLOAD_BYTES}",
                    )
                temp.write(chunk)

        if bytes_written == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

        result = sync_from_workbook(db, workbook_path=temp_path)
        return _to_sync_response(result)
    finally:
        await file.close()
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
