"""Work item master and project item endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Project, ProjectItem, WorkItemMaster
from ..schemas import ProjectItemCreate, ProjectItemRead, WorkItemMasterRead

router = APIRouter(tags=["work-items"])


@router.get("/work-items", response_model=list[WorkItemMasterRead])
def list_work_items(
    category: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[WorkItemMasterRead]:
    stmt = select(WorkItemMaster)
    if category:
        stmt = stmt.where(WorkItemMaster.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(WorkItemMaster.item_name.like(like))
    stmt = stmt.order_by(WorkItemMaster.category.asc(), WorkItemMaster.item_name.asc()).limit(limit)

    rows = db.execute(stmt).scalars().all()
    return [
        WorkItemMasterRead(
            id=row.id,
            source_item_id=row.source_item_id,
            category=row.category,
            item_name=row.item_name,
            specification=row.specification,
            unit=row.unit,
            standard_unit_price=row.standard_unit_price,
            default_vendor_name=row.default_vendor_name,
            margin_rate=row.margin_rate,
        )
        for row in rows
    ]


@router.get("/projects/{project_id}/items", response_model=list[ProjectItemRead])
def list_project_items(project_id: str, db: Session = Depends(get_db)) -> list[ProjectItemRead]:
    project = db.execute(select(Project).where(Project.project_id == project_id)).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    rows = db.execute(
        select(ProjectItem).where(ProjectItem.project_id == project_id).order_by(ProjectItem.id.asc())
    ).scalars().all()
    return [
        ProjectItemRead(
            id=row.id,
            project_id=row.project_id,
            category=row.category,
            item_name=row.item_name,
            specification=row.specification,
            unit=row.unit,
            quantity=row.quantity,
            unit_price=row.unit_price,
            line_total=row.line_total,
        )
        for row in rows
    ]


@router.post("/projects/{project_id}/items", response_model=ProjectItemRead, status_code=status.HTTP_201_CREATED)
def create_project_item(
    project_id: str,
    payload: ProjectItemCreate,
    db: Session = Depends(get_db),
) -> ProjectItemRead:
    project = db.execute(select(Project).where(Project.project_id == project_id)).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    master = None
    if payload.master_item_id is not None:
        master = db.execute(
            select(WorkItemMaster).where(WorkItemMaster.id == payload.master_item_id)
        ).scalar_one_or_none()
        if master is None:
            raise HTTPException(status_code=404, detail="Work item master not found")

    category = payload.category or (master.category if master else None)
    item_name = payload.item_name or (master.item_name if master else None)
    if not category or not item_name:
        raise HTTPException(status_code=422, detail="category and item_name are required")

    specification = payload.specification if payload.specification is not None else (master.specification if master else None)
    unit = payload.unit if payload.unit is not None else (master.unit if master else None)
    unit_price = payload.unit_price if payload.unit_price is not None else (master.standard_unit_price if master else 0.0)

    line_total = payload.quantity * unit_price

    item = ProjectItem(
        project_id=project_id,
        category=category,
        item_name=item_name,
        specification=specification,
        unit=unit,
        quantity=payload.quantity,
        unit_price=unit_price,
        line_total=line_total,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return ProjectItemRead(
        id=item.id,
        project_id=item.project_id,
        category=item.category,
        item_name=item.item_name,
        specification=item.specification,
        unit=item.unit,
        quantity=item.quantity,
        unit_price=item.unit_price,
        line_total=item.line_total,
    )
