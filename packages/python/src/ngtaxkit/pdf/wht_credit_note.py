"""WHT Credit Note PDF generation using fpdf2."""

from __future__ import annotations

from typing import Any

from . import _require_fpdf2
from .helpers import (
    COLOR_HEADER_BG, COLOR_LINE, COLOR_PRIMARY, COLOR_SECONDARY, COLOR_WHITE,
    CONTENT_WIDTH, PAGE_MARGIN, format_currency, format_date,
)


def _cur(amount: float) -> str:
    """Format currency for PDF output (latin-1 safe)."""
    return format_currency(amount, pdf_safe=True)


def create(
    *,
    deductor: dict[str, Any],
    beneficiary: dict[str, Any],
    gross_amount: float,
    wht_rate: float,
    wht_amount: float,
    net_payment: float,
    service_description: str,
    payment_date: str,
    credit_note_number: str,
    remittance_receipt_number: str | None = None,
    legal_basis: str | None = None,
) -> dict[str, Any]:
    """Build a WHT Credit Note data dict."""
    return {
        "deductor": deductor,
        "beneficiary": beneficiary,
        "gross_amount": gross_amount,
        "wht_rate": wht_rate,
        "wht_amount": wht_amount,
        "net_payment": net_payment,
        "service_description": service_description,
        "payment_date": payment_date,
        "credit_note_number": credit_note_number,
        "remittance_receipt_number": remittance_receipt_number,
        "legal_basis": legal_basis or "WHT Regulations 2024; NTA 2025 Part IV",
    }


def to_pdf(note: dict[str, Any]) -> bytes:
    """Generate a WHT Credit Note PDF as bytes."""
    fpdf = _require_fpdf2()
    pdf = fpdf.FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # -- WHT CREDIT NOTE banner --
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(CONTENT_WIDTH, 10, "WHT CREDIT NOTE", fill=True, align="C",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Credit note number and payment date --
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, f"Credit Note #: {note['credit_note_number']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Payment Date: {format_date(note['payment_date'])}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- Deductor (Payer) section --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Deductor (Payer):", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, note["deductor"]["name"], new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {note['deductor']['tin']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, note["deductor"]["address"], new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Beneficiary (Payee) section --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Beneficiary (Payee):", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, note["beneficiary"]["name"],
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {note['beneficiary']['tin']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, note["beneficiary"]["address"],
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- Payment Details table --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Payment Details", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    col_label = 90
    col_value = 90

    pdf.set_fill_color(*COLOR_HEADER_BG)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(col_label, 6, "Item", fill=True, align="L")
    pdf.cell(col_value, 6, "Details", fill=True, align="R")
    pdf.ln()

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)

    rows = [
        ("Service Description", note["service_description"]),
        ("Gross Amount", _cur(note["gross_amount"])),
        ("WHT Rate", f"{note['wht_rate'] * 100:.1f}%"),
        ("WHT Amount", _cur(note["wht_amount"])),
        ("Net Payment", _cur(note["net_payment"])),
    ]
    if note.get("remittance_receipt_number"):
        rows.append(("Remittance Receipt #", note["remittance_receipt_number"]))

    for label, value in rows:
        pdf.cell(col_label, 5, label, align="L")
        pdf.cell(col_value, 5, value, align="R")
        pdf.ln()
        pdf.set_draw_color(*COLOR_LINE)
        pdf.line(pdf.l_margin, pdf.get_y(),
                 pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
        pdf.ln(1)

    pdf.ln(6)

    # -- Legal basis footer --
    pdf.set_draw_color(*COLOR_LINE)
    pdf.line(pdf.l_margin, pdf.get_y(),
             pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.multi_cell(CONTENT_WIDTH, 3,
                   f"Legal Basis: {note['legal_basis']}")
    pdf.ln(2)
    pdf.cell(CONTENT_WIDTH, 3,
             f"Generated by ngtaxkit -- WHT Credit Note {note['credit_note_number']}",
             align="C")

    return pdf.output()
