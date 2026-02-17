"""Document/PDF endpoints."""

from __future__ import annotations

from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, Project
from ..schemas import EstimateCoverRequest, ReceiptRequest
from ..security import require_api_key
from ..services.pdf import render_estimate_cover_pdf, render_receipt_pdf
from ..services.sanitize import sanitize_file_name

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/estimate-cover")
def export_estimate_cover(
    payload: EstimateCoverRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
) -> Response:
    project = db.execute(
        select(Project).where(Project.project_id == payload.project_id)
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    pdf_bytes = render_estimate_cover_pdf(
        project_id=project.project_id,
        project_name=project.project_name,
        customer_name=project.customer_name,
        site_address=project.site_address,
    )

    filename = f"見積書_{sanitize_file_name(project.project_name, '案件未設定')}_{date.today():%Y%m%d}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )


@router.post("/receipt")
def export_receipt(
    payload: ReceiptRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
) -> Response:
    invoice = db.execute(
        select(Invoice).where(Invoice.invoice_id == payload.invoice_id)
    ).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    project = db.execute(
        select(Project).where(Project.project_id == invoice.project_id)
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    pdf_bytes = render_receipt_pdf(
        invoice_id=invoice.invoice_id,
        project_id=invoice.project_id,
        amount=invoice.invoice_amount,
    )

    filename = f"領収書_{sanitize_file_name(invoice.invoice_id, '請求ID未設定')}_{date.today():%Y%m%d}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )
