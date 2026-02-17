"""Dashboard summary endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, Payment, Project, ProjectItem
from ..schemas import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummaryResponse:
    project_total = db.execute(select(func.count(Project.id))).scalar_one() or 0

    status_rows = db.execute(
        select(Project.project_status, func.count(Project.id)).group_by(Project.project_status)
    ).all()
    project_status_counts = {
        (status if status else "未設定"): int(count)
        for status, count in status_rows
    }

    invoice_total_amount = db.execute(select(func.coalesce(func.sum(Invoice.invoice_amount), 0.0))).scalar_one() or 0.0
    invoice_remaining_amount = (
        db.execute(select(func.coalesce(func.sum(Invoice.remaining_amount), 0.0))).scalar_one() or 0.0
    )

    payment_total_amount = db.execute(select(func.coalesce(func.sum(Payment.ordered_amount), 0.0))).scalar_one() or 0.0
    payment_remaining_amount = (
        db.execute(select(func.coalesce(func.sum(Payment.remaining_amount), 0.0))).scalar_one() or 0.0
    )

    item_total_amount = db.execute(select(func.coalesce(func.sum(ProjectItem.line_total), 0.0))).scalar_one() or 0.0

    return DashboardSummaryResponse(
        project_total=int(project_total),
        project_status_counts=project_status_counts,
        invoice_total_amount=float(invoice_total_amount),
        invoice_remaining_amount=float(invoice_remaining_amount),
        payment_total_amount=float(payment_total_amount),
        payment_remaining_amount=float(payment_remaining_amount),
        item_total_amount=float(item_total_amount),
    )
