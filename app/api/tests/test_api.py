"""Basic API tests for MVP endpoints."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

TMP_DIR = Path(tempfile.mkdtemp(prefix="link-estimate-api-test-"))
os.environ["APP_DATABASE_URL"] = f"sqlite:///{(TMP_DIR / 'test.db').as_posix()}"

from app.main import app  # noqa: E402


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


def test_customers() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/v1/customers")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1


def test_create_project_and_list() -> None:
    with TestClient(app) as client:
        create_resp = client.post(
            "/api/v1/projects",
            json={
                "customer_id": "C-001",
                "project_name": "APIテスト案件",
                "site_address": "東京都",
            },
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["project_id"].startswith("P-")

        list_resp = client.get("/api/v1/projects")
        assert list_resp.status_code == 200
        payload = list_resp.json()
        assert payload["total"] >= 1


def test_document_exports() -> None:
    with TestClient(app) as client:
        estimate = client.post(
            "/api/v1/documents/estimate-cover",
            json={"project_id": "P-003"},
        )
        assert estimate.status_code == 200
        assert estimate.headers["content-type"] == "application/pdf"

        receipt = client.post(
            "/api/v1/documents/receipt",
            json={"invoice_id": "INV-001"},
        )
        assert receipt.status_code == 200
        assert receipt.headers["content-type"] == "application/pdf"
