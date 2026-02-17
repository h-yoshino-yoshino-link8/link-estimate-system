"""Invoice and payment endpoints."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, Payment, Project
from ..schemas import (
    InvoiceCreate,
    InvoiceRead,
    InvoiceUpdate,
    PaymentCreate,
    PaymentRead,
    PaymentUpdate,
)
from ..services.id_generator import get_next_invoice_id, get_next_payment_id

router = APIRouter(tags=["finance"])


def _derive_invoice_status(invoice_amount: float, paid_amount: float) -> str:
    remaining = max(invoice_amount - paid_amount, 0.0)
    if invoice_amount <= 0:
        return "❌未入金"
    if remaining <= 0:
        return "✅入金済"
    if paid_amount > 0:
        return "⚠一部入金"
    return "❌未入金"


def _derive_payment_status(ordered_amount: float, paid_amount: float) -> str:
    remaining = max(ordered_amount - paid_amount, 0.0)
    if ordered_amount <= 0:
        return "❌未支払"
    if remaining <= 0:
        return "✅支払済"
    if paid_amount > 0:
        return "⚠一部支払"
    return "❌未支払"


def _invoice_to_read(row: Invoice) -> InvoiceRead:
    return InvoiceRead(
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


def _payment_to_read(row: Payment) -> PaymentRead:
    return PaymentRead(
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
    return [_invoice_to_read(row) for row in rows]


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
        billed_at=payload.billed_at or date.today(),
        paid_amount=payload.paid_amount,
        remaining_amount=remaining,
        status=payload.status or _derive_invoice_status(payload.invoice_amount, payload.paid_amount),
        note=payload.note,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return _invoice_to_read(invoice)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceRead)
def update_invoice(invoice_id: str, payload: InvoiceUpdate, db: Session = Depends(get_db)) -> InvoiceRead:
    invoice = db.execute(select(Invoice).where(Invoice.invoice_id == invoice_id)).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.invoice_amount is not None:
        invoice.invoice_amount = payload.invoice_amount
    if payload.paid_amount is not None:
        invoice.paid_amount = payload.paid_amount
    if payload.billed_at is not None:
        invoice.billed_at = payload.billed_at
    if payload.note is not None:
        invoice.note = payload.note

    invoice.remaining_amount = max(invoice.invoice_amount - invoice.paid_amount, 0.0)
    invoice.status = payload.status or _derive_invoice_status(invoice.invoice_amount, invoice.paid_amount)

    db.commit()
    db.refresh(invoice)
    return _invoice_to_read(invoice)


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
    return [_payment_to_read(row) for row in rows]


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
        status=payload.status or _derive_payment_status(payload.ordered_amount, payload.paid_amount),
        note=payload.note,
        paid_at=payload.paid_at,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return _payment_to_read(payment)


@router.patch("/payments/{payment_id}", response_model=PaymentRead)
def update_payment(payment_id: str, payload: PaymentUpdate, db: Session = Depends(get_db)) -> PaymentRead:
    payment = db.execute(select(Payment).where(Payment.payment_id == payment_id)).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payload.ordered_amount is not None:
        payment.ordered_amount = payload.ordered_amount
    if payload.paid_amount is not None:
        payment.paid_amount = payload.paid_amount
    if payload.paid_at is not None:
        payment.paid_at = payload.paid_at
    if payload.note is not None:
        payment.note = payload.note
    if payload.vendor_name is not None:
        payment.vendor_name = payload.vendor_name
    if payload.work_description is not None:
        payment.work_description = payload.work_description

    payment.remaining_amount = max(payment.ordered_amount - payment.paid_amount, 0.0)
    payment.status = payload.status or _derive_payment_status(payment.ordered_amount, payment.paid_amount)

    db.commit()
    db.refresh(payment)
    return _payment_to_read(payment)
