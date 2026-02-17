"""Project endpoints."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Customer, Project
from ..schemas import ProjectCreate, ProjectListResponse, ProjectRead
from ..services.id_generator import get_next_project_id
from ..services.sanitize import build_unique_sheet_name, sanitize_sheet_name

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectRead:
    customer = db.execute(
        select(Customer).where(Customer.customer_id == payload.customer_id)
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    project_name = payload.project_name.strip()
    if not project_name:
        raise HTTPException(status_code=422, detail="project_name is required")

    next_id = get_next_project_id(db)

    existing_sheet_names = set(db.execute(select(Project.project_sheet_name)).scalars().all())
    base_sheet_name = sanitize_sheet_name(f"{next_id}_{project_name}", f"{next_id}_案件")
    unique_sheet_name = build_unique_sheet_name(base_sheet_name, existing_sheet_names)

    owner_name = (payload.owner_name or "").strip() or "吉野博"
    target_margin_rate = payload.target_margin_rate if payload.target_margin_rate else 0.25
    if target_margin_rate <= 0:
        target_margin_rate = 0.25

    project = Project(
        project_id=next_id,
        project_sheet_name=unique_sheet_name,
        customer_id=customer.customer_id,
        customer_name=customer.customer_name,
        project_name=project_name,
        site_address=(payload.site_address or "").strip() or None,
        owner_name=owner_name,
        target_margin_rate=target_margin_rate,
        project_status="①リード",
        created_at=date.today(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectRead(
        project_id=project.project_id,
        project_sheet_name=project.project_sheet_name,
        customer_id=project.customer_id,
        customer_name=project.customer_name,
        project_name=project.project_name,
        site_address=project.site_address,
        owner_name=project.owner_name,
        target_margin_rate=project.target_margin_rate,
        project_status=project.project_status,
        created_at=project.created_at,
    )


@router.get("", response_model=ProjectListResponse)
def list_projects(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    customer_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    stmt = select(Project)
    if status_filter:
        stmt = stmt.where(Project.project_status == status_filter)
    if customer_id:
        stmt = stmt.where(Project.customer_id == customer_id)
    stmt = stmt.order_by(Project.project_id.asc())

    rows = db.execute(stmt).scalars().all()
    items = [
        ProjectRead(
            project_id=row.project_id,
            project_sheet_name=row.project_sheet_name,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            project_name=row.project_name,
            site_address=row.site_address,
            owner_name=row.owner_name,
            target_margin_rate=row.target_margin_rate,
            project_status=row.project_status,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return ProjectListResponse(items=items, total=len(items))
