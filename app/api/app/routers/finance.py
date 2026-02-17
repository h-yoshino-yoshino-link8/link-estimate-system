"""Invoice and payment endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, Payment, Project
from ..schemas import InvoiceCreate, InvoiceRead, PaymentCreate, PaymentRead
from ..services.id_generator import get_next_invoice_id, get_next_payment_id

router = APIRouter(tags=["finance"])


@router.get("/invoices", response_model=list[InvoiceRead])
def list_invoices(
    project_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[InvoiceRead]:
    stmt = select(Invoice)
    if project_id:
        stmt = stmt.where(Invoice.project_id == project_id)
    stmt = stmt.order_by(Invoice.invoice_id.asc())

    rows = db.execute(stmt).scalars().all()
    return [
        InvoiceRead(
            invoice_id=row.invoice_id,
            project_id=row.project_id,
            invoice_amount=row.invoice_amount,
            invoice_type=row.invoice_type,
            billed_at=row.billed_at,
            paid_amount=row.paid_amount,
            remaining_amount=row.remaining_amount,
            status=row.status,
            note=row.note,
        )
        for row in rows
    ]


@router.post("/invoices", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)) -> InvoiceRead:
    project = db.execute(select(Project).where(Project.project_id == payload.project_id)).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    invoice_id = (payload.invoice_id or "").strip() or get_next_invoice_id(db)

    existing = db.execute(select(Invoice).where(Invoice.invoice_id == invoice_id)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Invoice ID already exists")

    remaining = max(payload.invoice_amount - payload.paid_amount, 0.0)

    invoice = Invoice(
        invoice_id=invoice_id,
        project_id=payload.project_id,
        invoice_amount=payload.invoice_amount,
        invoice_type=payload.invoice_type,
        billed_at=payload.billed_at,
        paid_amount=payload.paid_amount,
        remaining_amount=remaining,
        status=payload.status,
        note=payload.note,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return InvoiceRead(
        invoice_id=invoice.invoice_id,
        project_id=invoice.project_id,
        invoice_amount=invoice.invoice_amount,
        invoice_type=invoice.invoice_type,
        billed_at=invoice.billed_at,
        paid_amount=invoice.paid_amount,
        remaining_amount=invoice.remaining_amount,
        status=invoice.status,
        note=invoice.note,
    )


@router.get("/payments", response_model=list[PaymentRead])
def list_payments(
    project_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[PaymentRead]:
    stmt = select(Payment)
    if project_id:
        stmt = stmt.where(Payment.project_id == project_id)
    stmt = stmt.order_by(Payment.payment_id.asc())

    rows = db.execute(stmt).scalars().all()
    return [
        PaymentRead(
            payment_id=row.payment_id,
            project_id=row.project_id,
            vendor_id=row.vendor_id,
            vendor_name=row.vendor_name,
            work_description=row.work_description,
            ordered_amount=row.ordered_amount,
            paid_amount=row.paid_amount,
            remaining_amount=row.remaining_amount,
            status=row.status,
            note=row.note,
            paid_at=row.paid_at,
        )
        for row in rows
    ]


@router.post("/payments", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db)) -> PaymentRead:
    project = db.execute(select(Project).where(Project.project_id == payload.project_id)).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    payment_id = (payload.payment_id or "").strip() or get_next_payment_id(db)

    existing = db.execute(select(Payment).where(Payment.payment_id == payment_id)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Payment ID already exists")

    remaining = max(payload.ordered_amount - payload.paid_amount, 0.0)

    payment = Payment(
        payment_id=payment_id,
        project_id=payload.project_id,
        vendor_id=payload.vendor_id,
        vendor_name=payload.vendor_name,
        work_description=payload.work_description,
        ordered_amount=payload.ordered_amount,
        paid_amount=payload.paid_amount,
        remaining_amount=remaining,
        status=payload.status,
        note=payload.note,
        paid_at=payload.paid_at,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return PaymentRead(
        payment_id=payment.payment_id,
        project_id=payment.project_id,
        vendor_id=payment.vendor_id,
        vendor_name=payment.vendor_name,
        work_description=payment.work_description,
        ordered_amount=payment.ordered_amount,
        paid_amount=payment.paid_amount,
        remaining_amount=payment.remaining_amount,
        status=payment.status,
        note=payment.note,
        paid_at=payment.paid_at,
    )
