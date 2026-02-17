"""ID generation helpers compatible with Excel rules."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Project

PROJECT_ID_PATTERN = re.compile(r"^P-(\d+)$")


def get_next_project_id(db: Session) -> str:
    rows = db.execute(select(Project.project_id)).scalars().all()
    max_num = 0
    for project_id in rows:
        m = PROJECT_ID_PATTERN.match(project_id.strip())
        if not m:
            continue
        n = int(m.group(1))
        if n > max_num:
            max_num = n
    return f"P-{max_num + 1:03d}"
