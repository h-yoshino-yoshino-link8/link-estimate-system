"""Excel sync endpoint."""

from __future__ import annotations

import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, HTTPException
from fastapi import File as FastAPIFile
from fastapi import UploadFile, status
from sqlalchemy.orm import Session

from ..config import EXCEL_SOURCE_PATH
from ..database import get_db
from ..schemas import ExcelSyncRequest, ExcelSyncResponse
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


@router.post("/excel", response_model=ExcelSyncResponse)
def sync_excel(payload: ExcelSyncRequest, db: Session = Depends(get_db)) -> ExcelSyncResponse:
    workbook_path = payload.workbook_path or EXCEL_SOURCE_PATH
    try:
        result = sync_from_workbook(db, workbook_path=workbook_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return _to_sync_response(result)


@router.post("/excel/upload", response_model=ExcelSyncResponse)
async def sync_excel_upload(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
) -> ExcelSyncResponse:
    suffix = Path(file.filename or "upload.xlsx").suffix.lower()
    if suffix not in {".xlsx", ".xlsm", ".xltx", ".xltm"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension. Use .xlsx or .xlsm",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    temp_path = ""
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(payload)
            temp_path = temp.name

        result = sync_from_workbook(db, workbook_path=temp_path)
        return _to_sync_response(result)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
