"""Pydantic schemas for API I/O."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class CustomerRead(BaseModel):
    customer_id: str
    customer_name: str
    contact_name: Optional[str] = None
    status: str


class ProjectCreate(BaseModel):
    customer_id: str = Field(..., min_length=1)
    project_name: str = Field(..., min_length=1)
    site_address: Optional[str] = None
    owner_name: Optional[str] = None
    target_margin_rate: Optional[float] = None


class ProjectRead(BaseModel):
    project_id: str
    project_sheet_name: str
    customer_id: str
    customer_name: str
    project_name: str
    site_address: Optional[str] = None
    owner_name: str
    target_margin_rate: float
    project_status: str
    created_at: date


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
    total: int


class EstimateCoverRequest(BaseModel):
    project_id: str


class ReceiptRequest(BaseModel):
    invoice_id: str
