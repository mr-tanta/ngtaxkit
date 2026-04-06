"""Invoice PDF generation using fpdf2."""

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


def to_pdf(inv: dict[str, Any]) -> bytes:
    """Generate an invoice PDF as bytes."""
    fpdf = _require_fpdf2()
    pdf = fpdf.FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # -- Letterhead --
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 8, inv["seller"]["name"], new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, inv["seller"]["address"], new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {inv['seller']['tin']}", new_x="LMARGIN", new_y="NEXT")
    if inv["seller"].get("vrn"):
        pdf.cell(0, 4, f"VRN: {inv['seller']['vrn']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- TAX INVOICE banner --
    type_label = {"credit-note": "CREDIT NOTE", "debit-note": "DEBIT NOTE"}.get(inv["type"], "TAX INVOICE")
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(CONTENT_WIDTH, 10, type_label, fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Invoice metadata --
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, f"Invoice #: {inv['invoice_number']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Issue Date: {format_date(inv['issue_date'])}", new_x="LMARGIN", new_y="NEXT")
    if inv.get("due_date"):
        pdf.cell(0, 4, f"Due Date: {format_date(inv['due_date'])}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Currency: {inv['currency']}", new_x="LMARGIN", new_y="NEXT")
    if inv.get("purchase_order_ref"):
        pdf.cell(0, 4, f"PO Ref: {inv['purchase_order_ref']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Bill To --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Bill To:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, inv["buyer"]["name"], new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, inv["buyer"]["address"], new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {inv['buyer']['tin']}", new_x="LMARGIN", new_y="NEXT")
    if inv["buyer"].get("vrn"):
        pdf.cell(0, 4, f"VRN: {inv['buyer']['vrn']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- Line items table --
    col_widths = [60, 15, 30, 22, 25, 28]
    headers = ["Description", "Qty", "Unit Price", "VAT %", "VAT Amt", "Total"]

    pdf.set_fill_color(*COLOR_HEADER_BG)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*COLOR_PRIMARY)
    for i, h in enumerate(headers):
        align = "L" if i == 0 else "R"
        pdf.cell(col_widths[i], 6, h, border=0, fill=True, align=align)
    pdf.ln()

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*COLOR_SECONDARY)
    for item in inv["items"]:
        pdf.cell(col_widths[0], 5, item["description"][:40], align="L")
        pdf.cell(col_widths[1], 5, str(item["quantity"]), align="R")
        pdf.cell(col_widths[2], 5, _cur(item["unit_price"]), align="R")
        pdf.cell(col_widths[3], 5, f"{item['vat_rate'] * 100:.1f}%", align="R")
        pdf.cell(col_widths[4], 5, _cur(item["vat_amount"]), align="R")
        pdf.cell(col_widths[5], 5, _cur(item["line_total"]), align="R")
        pdf.ln()
        pdf.set_draw_color(*COLOR_LINE)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
        pdf.ln(1)

    pdf.ln(4)

    # -- Totals --
    totals_x = pdf.l_margin + CONTENT_WIDTH - 70
    pdf.set_font("Helvetica", "", 9)
    for label, value in [("Subtotal:", inv["subtotal"]), ("Total VAT:", inv["total_vat"])]:
        pdf.set_x(totals_x)
        pdf.cell(35, 5, label, align="L")
        pdf.cell(35, 5, _cur(value), align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.set_x(totals_x)
    pdf.cell(35, 6, "TOTAL:", align="L")
    pdf.cell(35, 6, _cur(inv["total"]), align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- VAT breakdown --
    if inv["vat_breakdown"]:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, 5, "VAT Breakdown", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_SECONDARY)
        for entry in inv["vat_breakdown"]:
            rt = entry["rate_type"]
            rate_label = f"{entry['rate'] * 100:.1f}% ({rt.replace('-', ' ').title()})"
            pdf.cell(0, 4,
                f"{rate_label}  --  Taxable: {_cur(entry['taxable_amount'])}  |  VAT: {_cur(entry['vat_amount'])}",
                new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # -- Notes --
    if inv.get("notes"):
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_SECONDARY)
        pdf.cell(0, 4, f"Notes: {inv['notes']}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # -- Footer --
    pdf.set_draw_color(*COLOR_LINE)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.multi_cell(CONTENT_WIDTH, 3,
        "This invoice is issued in compliance with the Nigeria Tax Act (NTA) 2025 and VAT Act as amended. "
        "VAT is charged at the applicable rate per NTA 2025 Schedule 1 (zero-rated), Schedule 2 (exempt), "
        "or the standard rate of 7.5%. All amounts are in Nigerian Naira (NGN) unless otherwise stated.")
    pdf.ln(2)
    pdf.cell(CONTENT_WIDTH, 3,
        f"Generated by ngtaxkit -- Invoice {inv['invoice_number']} | {inv['seller']['tin']}",
        align="C")

    return pdf.output()
