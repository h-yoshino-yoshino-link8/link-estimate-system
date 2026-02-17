"""PDF generation services for MVP documents."""

from __future__ import annotations

from io import BytesIO
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def _new_canvas(buffer: BytesIO) -> canvas.Canvas:
    return canvas.Canvas(buffer, pagesize=A4)


def render_estimate_cover_pdf(
    *,
    project_id: str,
    project_name: str,
    customer_name: str,
    site_address: Optional[str],
) -> bytes:
    buffer = BytesIO()
    pdf = _new_canvas(buffer)
    pdf.setTitle(f"Estimate {project_id}")
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(72, 790, "Estimate Cover")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(72, 760, f"Project ID: {project_id}")
    pdf.drawString(72, 742, f"Project Name: {project_name}")
    pdf.drawString(72, 724, f"Customer: {customer_name}")
    pdf.drawString(72, 706, f"Site Address: {site_address or '-'}")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def render_receipt_pdf(
    *,
    invoice_id: str,
    project_id: str,
    amount: float,
) -> bytes:
    buffer = BytesIO()
    pdf = _new_canvas(buffer)
    pdf.setTitle(f"Receipt {invoice_id}")
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(72, 790, "Receipt")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(72, 760, f"Invoice ID: {invoice_id}")
    pdf.drawString(72, 742, f"Project ID: {project_id}")
    pdf.drawString(72, 724, f"Amount: {amount:,.0f}")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
