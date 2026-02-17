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


class ExcelSyncRequest(BaseModel):
    workbook_path: Optional[str] = None


class ExcelSyncResponse(BaseModel):
    workbook_path: str
    customers_upserted: int
    projects_upserted: int
    invoices_upserted: int
    payments_upserted: int
    work_items_upserted: int


class WorkItemMasterRead(BaseModel):
    id: int
    source_item_id: Optional[int] = None
    category: str
    item_name: str
    specification: Optional[str] = None
    unit: Optional[str] = None
    standard_unit_price: float
    default_vendor_name: Optional[str] = None
    margin_rate: Optional[float] = None


class ProjectItemCreate(BaseModel):
    master_item_id: Optional[int] = None
    category: Optional[str] = None
    item_name: Optional[str] = None
    specification: Optional[str] = None
    unit: Optional[str] = None
    quantity: float = Field(default=1.0, gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)


class ProjectItemRead(BaseModel):
    id: int
    project_id: str
    category: str
    item_name: str
    specification: Optional[str] = None
    unit: Optional[str] = None
    quantity: float
    unit_price: float
    line_total: float


class InvoiceCreate(BaseModel):
    project_id: str
    invoice_id: Optional[str] = None
    invoice_amount: float = Field(default=0.0, ge=0)
    invoice_type: Optional[str] = None
    billed_at: Optional[date] = None
    paid_amount: float = Field(default=0.0, ge=0)
    status: Optional[str] = None
    note: Optional[str] = None


class InvoiceRead(BaseModel):
    invoice_id: str
    project_id: str
    invoice_amount: float
    invoice_type: Optional[str] = None
    billed_at: Optional[date] = None
    paid_amount: float
    remaining_amount: float
    status: Optional[str] = None
    note: Optional[str] = None


class InvoiceUpdate(BaseModel):
    invoice_amount: Optional[float] = Field(default=None, ge=0)
    paid_amount: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None
    note: Optional[str] = None
    billed_at: Optional[date] = None


class PaymentCreate(BaseModel):
    project_id: str
    payment_id: Optional[str] = None
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    work_description: Optional[str] = None
    ordered_amount: float = Field(default=0.0, ge=0)
    paid_amount: float = Field(default=0.0, ge=0)
    status: Optional[str] = None
    note: Optional[str] = None
    paid_at: Optional[date] = None


class PaymentRead(BaseModel):
    payment_id: str
    project_id: str
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    work_description: Optional[str] = None
    ordered_amount: float
    paid_amount: float
    remaining_amount: float
    status: Optional[str] = None
    note: Optional[str] = None
    paid_at: Optional[date] = None


class PaymentUpdate(BaseModel):
    ordered_amount: Optional[float] = Field(default=None, ge=0)
    paid_amount: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None
    note: Optional[str] = None
    paid_at: Optional[date] = None
    vendor_name: Optional[str] = None
    work_description: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    project_total: int
    project_status_counts: dict[str, int]
    invoice_total_amount: float
    invoice_remaining_amount: float
    payment_total_amount: float
    payment_remaining_amount: float
    item_total_amount: float
