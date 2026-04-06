"""Form H1 (Annual PAYE Return) PDF generation using fpdf2."""

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
    employer: dict[str, Any],
    tax_year: int,
    state: str,
    state_irs_name: str,
    employees: list[dict[str, Any]],
    total_gross: float,
    total_tax: float,
    filing_date: str | None = None,
    form_number: str | None = None,
) -> dict[str, Any]:
    """Build a Form H1 data dict."""
    return {
        "employer": employer,
        "tax_year": tax_year,
        "state": state,
        "state_irs_name": state_irs_name,
        "employees": employees,
        "total_gross": total_gross,
        "total_tax": total_tax,
        "filing_date": filing_date,
        "form_number": form_number,
    }


def to_pdf(form: dict[str, Any]) -> bytes:
    """Generate a Form H1 PDF as bytes."""
    fpdf = _require_fpdf2()
    pdf = fpdf.FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    landscape_width = 267  # A4 landscape: 297mm - 2*15mm margins

    # -- FORM H1 header banner --
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(landscape_width, 10, "FORM H1 -- ANNUAL PAYE RETURN",
             fill=True, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- State IRS and tax year --
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 5, form["state_irs_name"], new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, f"Tax Year: {form['tax_year']}",
             new_x="LMARGIN", new_y="NEXT")
    if form.get("form_number"):
        pdf.cell(0, 5, f"Form #: {form['form_number']}",
                 new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Employer details --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Employer Details:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, form["employer"]["name"], new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {form['employer']['tin']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, form["employer"]["address"],
             new_x="LMARGIN", new_y="NEXT")
    if form["employer"].get("rc_number"):
        pdf.cell(0, 4, f"RC Number: {form['employer']['rc_number']}",
                 new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- Employee table --
    col_widths = [15, 55, 30, 38, 30, 38, 38, 23]
    headers = ["S/N", "Name", "TIN", "Gross Income", "Reliefs",
               "Taxable Income", "Tax Deducted", ""]

    # Adjust last column to fill remaining space
    used = sum(col_widths[:-1])
    col_widths[-1] = landscape_width - used
    headers[-1] = ""

    pdf.set_fill_color(*COLOR_HEADER_BG)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*COLOR_PRIMARY)
    actual_headers = ["S/N", "Name", "TIN", "Gross Income", "Reliefs",
                      "Taxable Income", "Tax Deducted"]
    actual_widths = col_widths[:7]
    for i, h in enumerate(actual_headers):
        align = "L" if i <= 2 else "R"
        pdf.cell(actual_widths[i], 6, h, border=0, fill=True, align=align)
    pdf.ln()

    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*COLOR_SECONDARY)
    for emp in form["employees"]:
        pdf.cell(actual_widths[0], 5,
                 str(emp.get("serial_number", "")), align="L")
        pdf.cell(actual_widths[1], 5,
                 str(emp.get("name", ""))[:35], align="L")
        pdf.cell(actual_widths[2], 5,
                 str(emp.get("tin", "")), align="L")
        pdf.cell(actual_widths[3], 5,
                 _cur(emp.get("gross_income", 0)), align="R")
        pdf.cell(actual_widths[4], 5,
                 _cur(emp.get("reliefs", 0)), align="R")
        pdf.cell(actual_widths[5], 5,
                 _cur(emp.get("taxable_income", 0)), align="R")
        pdf.cell(actual_widths[6], 5,
                 _cur(emp.get("tax_deducted", 0)), align="R")
        pdf.ln()
        pdf.set_draw_color(*COLOR_LINE)
        pdf.line(pdf.l_margin, pdf.get_y(),
                 pdf.l_margin + landscape_width, pdf.get_y())
        pdf.ln(1)

    # -- Totals row --
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(actual_widths[0] + actual_widths[1] + actual_widths[2], 6,
             "TOTALS", align="L")
    pdf.cell(actual_widths[3], 6, _cur(form["total_gross"]), align="R")
    pdf.cell(actual_widths[4], 6, "", align="R")
    pdf.cell(actual_widths[5], 6, "", align="R")
    pdf.cell(actual_widths[6], 6, _cur(form["total_tax"]), align="R")
    pdf.ln()
    pdf.ln(6)

    # -- Filing date footer --
    pdf.set_draw_color(*COLOR_LINE)
    pdf.line(pdf.l_margin, pdf.get_y(),
             pdf.l_margin + landscape_width, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*COLOR_SECONDARY)
    if form.get("filing_date"):
        pdf.cell(0, 4, f"Filing Date: {format_date(form['filing_date'])}",
                 new_x="LMARGIN", new_y="NEXT")
    pdf.cell(landscape_width, 3,
             f"Generated by ngtaxkit -- Form H1 | Tax Year {form['tax_year']} | {form['employer']['tin']}",
             align="C")

    return pdf.output()
