"""Database models for MVP."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="アクティブ", nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    project_sheet_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    customer_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("customers.customer_id"), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    site_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    owner_name: Mapped[str] = mapped_column(String(128), nullable=False, default="吉野博")
    target_margin_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.25)
    project_status: Mapped[str] = mapped_column(String(64), nullable=False, default="①リード")
    created_at: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    created_at_ts: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    customer: Mapped[Customer] = relationship("Customer")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_id: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    project_id: Mapped[str] = mapped_column(
        String(16), ForeignKey("projects.project_id"), nullable=False, index=True
    )
    invoice_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    project: Mapped[Project] = relationship("Project")
