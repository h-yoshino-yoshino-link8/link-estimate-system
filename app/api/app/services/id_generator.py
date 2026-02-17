"""ID generation helpers compatible with Excel rules."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Invoice, Payment, Project

PROJECT_ID_PATTERN = re.compile(r"^P-(\d+)$")
INVOICE_ID_PATTERN = re.compile(r"^INV-(\d+)$")
PAYMENT_ID_PATTERN = re.compile(r"^PAY-(\d+)$")


def _get_next_prefixed_id(ids: list[str], pattern: re.Pattern[str], prefix: str) -> str:
    max_num = 0
    for raw in ids:
        value = (raw or "").strip()
        m = pattern.match(value)
        if not m:
            continue
        n = int(m.group(1))
        if n > max_num:
            max_num = n
    return f"{prefix}-{max_num + 1:03d}"


def get_next_project_id(db: Session) -> str:
    rows = db.execute(select(Project.project_id)).scalars().all()
    return _get_next_prefixed_id(rows, PROJECT_ID_PATTERN, "P")


def get_next_invoice_id(db: Session) -> str:
    rows = db.execute(select(Invoice.invoice_id)).scalars().all()
    return _get_next_prefixed_id(rows, INVOICE_ID_PATTERN, "INV")


def get_next_payment_id(db: Session) -> str:
    rows = db.execute(select(Payment.payment_id)).scalars().all()
    return _get_next_prefixed_id(rows, PAYMENT_ID_PATTERN, "PAY")
