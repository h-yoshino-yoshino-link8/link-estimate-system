"""Dashboard summary endpoints."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, Payment, Project, ProjectItem
from ..schemas import (
    DashboardActiveProject,
    DashboardMonthlySalesPoint,
    DashboardOverviewResponse,
    DashboardSummaryResponse,
)

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


def _same_day_last_year(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        # Feb 29 fallback
        return value.replace(year=value.year - 1, day=28)


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(db: Session = Depends(get_db)) -> DashboardOverviewResponse:
    today = date.today()
    month_start = today.replace(day=1)
    last_year_cutoff = _same_day_last_year(today)

    all_time_sales = db.execute(select(func.coalesce(func.sum(Invoice.invoice_amount), 0.0))).scalar_one() or 0.0
    receivable_balance = (
        db.execute(select(func.coalesce(func.sum(Invoice.remaining_amount), 0.0))).scalar_one() or 0.0
    )
    payable_balance = (
        db.execute(select(func.coalesce(func.sum(Payment.remaining_amount), 0.0))).scalar_one() or 0.0
    )

    dated_invoices = db.execute(select(Invoice).where(Invoice.billed_at.is_not(None))).scalars().all()
    monthly_buckets = [0.0] * 12
    current_month_sales = 0.0
    ytd_sales = 0.0
    last_year_ytd_sales = 0.0

    for invoice in dated_invoices:
        billed_at = invoice.billed_at
        if billed_at is None:
            continue
        amount = float(invoice.invoice_amount or 0.0)

        if billed_at.year == today.year:
            monthly_buckets[billed_at.month - 1] += amount
            if month_start <= billed_at <= today:
                current_month_sales += amount
            if billed_at <= today:
                ytd_sales += amount
        elif billed_at.year == today.year - 1 and billed_at <= last_year_cutoff:
            last_year_ytd_sales += amount

    yoy_growth_rate = 0.0
    if last_year_ytd_sales > 0:
        yoy_growth_rate = ((ytd_sales - last_year_ytd_sales) / last_year_ytd_sales) * 100.0

    invoice_by_project_rows = db.execute(
        select(Invoice.project_id, func.coalesce(func.sum(Invoice.invoice_amount), 0.0)).group_by(Invoice.project_id)
    ).all()
    invoice_by_project = {project_id: float(total or 0.0) for project_id, total in invoice_by_project_rows}

    payment_by_project_rows = db.execute(
        select(Payment.project_id, func.coalesce(func.sum(Payment.ordered_amount), 0.0)).group_by(Payment.project_id)
    ).all()
    payment_by_project = {project_id: float(total or 0.0) for project_id, total in payment_by_project_rows}

    active_filter = or_(
        Project.project_status.is_(None),
        and_(
            not_(Project.project_status.like("%完工%")),
            not_(Project.project_status.like("%失注%")),
        ),
    )
    active_rows = db.execute(select(Project).where(active_filter).order_by(Project.created_at.desc())).scalars().all()

    active_projects = []
    for project in active_rows:
        invoice_total_amount = invoice_by_project.get(project.project_id, 0.0)
        payment_total_amount = payment_by_project.get(project.project_id, 0.0)
        active_projects.append(
            DashboardActiveProject(
                project_id=project.project_id,
                project_name=project.project_name,
                customer_name=project.customer_name,
                project_status=project.project_status or "未設定",
                site_address=project.site_address,
                created_at=project.created_at,
                invoice_total_amount=invoice_total_amount,
                payment_total_amount=payment_total_amount,
                gross_estimate=invoice_total_amount - payment_total_amount,
            )
        )

    monthly_sales_current_year = [
        DashboardMonthlySalesPoint(month=f"{month}月", amount=float(monthly_buckets[month - 1]))
        for month in range(1, 13)
    ]

    return DashboardOverviewResponse(
        current_month_sales=float(current_month_sales),
        ytd_sales=float(ytd_sales),
        all_time_sales=float(all_time_sales),
        last_year_ytd_sales=float(last_year_ytd_sales),
        yoy_growth_rate=float(yoy_growth_rate),
        receivable_balance=float(receivable_balance),
        payable_balance=float(payable_balance),
        active_project_count=len(active_projects),
        monthly_sales_current_year=monthly_sales_current_year,
        active_projects=active_projects[:12],
    )
