"""Seed initial dataset for local development."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Customer, Invoice, Project, ProjectItem, WorkItemMaster


def seed_data(db: Session) -> None:
    if not db.execute(select(Customer.id)).first():
        db.add_all(
            [
                Customer(
                    customer_id="C-001",
                    customer_name="矢島不動産管理株式会社",
                    contact_name="山本店長",
                    status="アクティブ",
                ),
                Customer(
                    customer_id="C-002",
                    customer_name="一建設株式会社",
                    contact_name="今村部長",
                    status="アクティブ",
                ),
            ]
        )
        db.commit()

    if not db.execute(select(Project.id)).first():
        db.add(
            Project(
                project_id="P-003",
                project_sheet_name="P-003_吉野様邸キッチン",
                customer_id="C-001",
                customer_name="矢島不動産管理株式会社",
                project_name="吉野様邸キッチン",
                site_address="東京都江戸川区北葛西1-2-22",
                owner_name="吉野博",
                target_margin_rate=0.25,
                project_status="⑦完工",
                created_at=date.today(),
            )
        )
        db.commit()

    if not db.execute(select(Invoice.id)).first():
        db.add(
            Invoice(
                invoice_id="INV-001",
                project_id="P-003",
                invoice_amount=1254440,
                note="seed",
            )
        )
        db.commit()

    if not db.execute(select(WorkItemMaster.id)).first():
        db.add_all(
            [
                WorkItemMaster(
                    source_item_id=1,
                    category="解体工事",
                    item_name="発生材処理費",
                    specification="混載",
                    unit="㎥",
                    standard_unit_price=20000,
                    default_vendor_name="株式会社テスト解体",
                    margin_rate=0.2,
                ),
                WorkItemMaster(
                    source_item_id=2,
                    category="電気設備",
                    item_name="分電盤交換",
                    specification="既存撤去含む",
                    unit="式",
                    standard_unit_price=85000,
                    default_vendor_name="株式会社テスト電設",
                    margin_rate=0.25,
                ),
            ]
        )
        db.commit()

    if not db.execute(select(ProjectItem.id)).first():
        db.add(
            ProjectItem(
                project_id="P-003",
                category="解体工事",
                item_name="発生材処理費",
                specification="混載",
                unit="㎥",
                quantity=2,
                unit_price=20000,
                line_total=40000,
            )
        )
        db.commit()
