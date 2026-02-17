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
from ..security import require_api_key
from ..services.id_generator import get_next_project_id
from ..services.sanitize import build_unique_sheet_name, sanitize_sheet_name

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_project_read(project: Project) -> ProjectRead:
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


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
) -> ProjectRead:
    customer = db.execute(select(Customer).where(Customer.customer_id == payload.customer_id)).scalar_one_or_none()
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

    return _to_project_read(project)


@router.get("", response_model=ProjectListResponse)
def list_projects(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    customer_id: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    stmt = select(Project)
    if status_filter:
        stmt = stmt.where(Project.project_status == status_filter)
    if customer_id:
        stmt = stmt.where(Project.customer_id == customer_id)
    stmt = stmt.order_by(Project.project_id.asc()).offset(offset).limit(limit)

    rows = db.execute(stmt).scalars().all()
    items = [_to_project_read(row) for row in rows]
    return ProjectListResponse(items=items, total=len(items))


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: str, db: Session = Depends(get_db)) -> ProjectRead:
    row = db.execute(select(Project).where(Project.project_id == project_id)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_project_read(row)
