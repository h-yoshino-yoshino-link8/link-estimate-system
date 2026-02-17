"""Excel sync endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import EXCEL_SOURCE_PATH
from ..database import get_db
from ..schemas import ExcelSyncRequest, ExcelSyncResponse
from ..services.excel_sync import sync_from_workbook

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/excel", response_model=ExcelSyncResponse)
def sync_excel(payload: ExcelSyncRequest, db: Session = Depends(get_db)) -> ExcelSyncResponse:
    workbook_path = payload.workbook_path or EXCEL_SOURCE_PATH
    try:
        result = sync_from_workbook(db, workbook_path=workbook_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ExcelSyncResponse(
        workbook_path=result.workbook_path,
        customers_upserted=result.customers_upserted,
        projects_upserted=result.projects_upserted,
        invoices_upserted=result.invoices_upserted,
        work_items_upserted=result.work_items_upserted,
    )
