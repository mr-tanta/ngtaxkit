"""VAT Return Summary PDF generation using fpdf2."""

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
    period: str,
    business_name: str,
    business_tin: str,
    business_vrn: str,
    sales_invoices: list[dict[str, Any]],
    purchase_invoices: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build a VAT Return data dict with computed totals."""
    output_vat = sum(inv.get("vat_amount", 0) for inv in sales_invoices)
    input_vat = sum(
        inv.get("vat_amount", 0) for inv in (purchase_invoices or [])
    )
    net_vat = output_vat - input_vat

    return {
        "period": period,
        "business_name": business_name,
        "business_tin": business_tin,
        "business_vrn": business_vrn,
        "sales_invoices": sales_invoices,
        "purchase_invoices": purchase_invoices or [],
        "output_vat": output_vat,
        "input_vat": input_vat,
        "net_vat": net_vat,
        "sales_count": len(sales_invoices),
        "purchase_count": len(purchase_invoices or []),
    }


def to_pdf(vat_return: dict[str, Any]) -> bytes:
    """Generate a VAT Return Summary PDF as bytes."""
    fpdf = _require_fpdf2()
    pdf = fpdf.FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # -- VAT RETURN SUMMARY banner --
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(CONTENT_WIDTH, 10, "VAT RETURN SUMMARY", fill=True, align="C",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Business details --
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, f"Business: {vat_return['business_name']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {vat_return['business_tin']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"VRN: {vat_return['business_vrn']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Period: {vat_return['period']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- Output VAT section --
    total_sales = sum(
        inv.get("amount", 0) for inv in vat_return["sales_invoices"]
    )
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Output VAT (Sales)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4,
             f"Total Sales: {_cur(total_sales)}  |  Output VAT: {_cur(vat_return['output_vat'])}  |  Invoices: {vat_return['sales_count']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Input VAT section (if purchase invoices) --
    if vat_return["purchase_invoices"]:
        total_purchases = sum(
            inv.get("amount", 0) for inv in vat_return["purchase_invoices"]
        )
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, 5, "Input VAT (Purchases)",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*COLOR_SECONDARY)
        pdf.cell(0, 4,
                 f"Total Purchases: {_cur(total_purchases)}  |  Input VAT: {_cur(vat_return['input_vat'])}  |  Invoices: {vat_return['purchase_count']}",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # -- Net VAT Payable highlighted --
    pdf.ln(2)
    col_label = 110
    col_value = 70
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(col_label, 10, "  NET VAT PAYABLE", fill=True, align="L")
    pdf.cell(col_value, 10, f"{_cur(vat_return['net_vat'])}  ", fill=True,
             align="R")
    pdf.ln()
    pdf.ln(6)

    # -- Sales invoice listing table --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Sales Invoices", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    s_col_widths = [45, 50, 45, 40]
    s_headers = ["Invoice #", "Amount", "VAT", "Rate Type"]

    pdf.set_fill_color(*COLOR_HEADER_BG)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*COLOR_PRIMARY)
    for i, h in enumerate(s_headers):
        align = "L" if i == 0 or i == 3 else "R"
        pdf.cell(s_col_widths[i], 6, h, border=0, fill=True, align=align)
    pdf.ln()

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*COLOR_SECONDARY)
    for inv in vat_return["sales_invoices"]:
        pdf.cell(s_col_widths[0], 5,
                 str(inv.get("invoice_number", ""))[:25], align="L")
        pdf.cell(s_col_widths[1], 5,
                 _cur(inv.get("amount", 0)), align="R")
        pdf.cell(s_col_widths[2], 5,
                 _cur(inv.get("vat_amount", 0)), align="R")
        pdf.cell(s_col_widths[3], 5,
                 str(inv.get("rate_type", "")).replace("-", " ").title(),
                 align="L")
        pdf.ln()
        pdf.set_draw_color(*COLOR_LINE)
        pdf.line(pdf.l_margin, pdf.get_y(),
                 pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
        pdf.ln(1)

    pdf.ln(4)

    # -- Purchase invoice listing table (if any) --
    if vat_return["purchase_invoices"]:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, 5, "Purchase Invoices",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

        pdf.set_fill_color(*COLOR_HEADER_BG)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*COLOR_PRIMARY)
        for i, h in enumerate(s_headers):
            align = "L" if i == 0 or i == 3 else "R"
            pdf.cell(s_col_widths[i], 6, h, border=0, fill=True, align=align)
        pdf.ln()

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_SECONDARY)
        for inv in vat_return["purchase_invoices"]:
            pdf.cell(s_col_widths[0], 5,
                     str(inv.get("invoice_number", ""))[:25], align="L")
            pdf.cell(s_col_widths[1], 5,
                     _cur(inv.get("amount", 0)), align="R")
            pdf.cell(s_col_widths[2], 5,
                     _cur(inv.get("vat_amount", 0)), align="R")
            pdf.cell(s_col_widths[3], 5,
                     str(inv.get("rate_type", "")).replace("-", " ").title(),
                     align="L")
            pdf.ln()
            pdf.set_draw_color(*COLOR_LINE)
            pdf.line(pdf.l_margin, pdf.get_y(),
                     pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
            pdf.ln(1)

        pdf.ln(4)

    # -- Legal footer --
    pdf.set_draw_color(*COLOR_LINE)
    pdf.line(pdf.l_margin, pdf.get_y(),
             pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.multi_cell(CONTENT_WIDTH, 3,
                   "This VAT return summary is prepared in accordance with the Nigeria Tax Act (NTA) 2025 "
                   "and the Value Added Tax Act as amended. VAT is charged at the applicable rate per NTA 2025 "
                   "Schedule 1 (zero-rated), Schedule 2 (exempt), or the standard rate of 7.5%.")
    pdf.ln(2)
    pdf.cell(CONTENT_WIDTH, 3,
             f"Generated by ngtaxkit -- VAT Return | {vat_return['period']} | {vat_return['business_tin']}",
             align="C")

    return pdf.output()
