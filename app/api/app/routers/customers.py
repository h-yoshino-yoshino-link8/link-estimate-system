"""Customer endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Customer
from ..schemas import CustomerRead

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)) -> list[CustomerRead]:
    rows = db.execute(select(Customer).order_by(Customer.customer_id.asc())).scalars().all()
    return [
        CustomerRead(
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            contact_name=row.contact_name,
            status=row.status,
        )
        for row in rows
    ]
