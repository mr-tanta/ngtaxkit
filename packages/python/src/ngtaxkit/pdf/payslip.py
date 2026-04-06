"""Employee Payslip PDF generation using fpdf2."""

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
    employee: dict[str, Any],
    pay_period: str,
    pay_date: str,
    earnings: list[dict[str, Any]],
    deductions: list[dict[str, Any]],
    gross_pay: float,
    total_deductions: float,
    net_pay: float,
    ytd_gross: float | None = None,
    ytd_tax: float | None = None,
) -> dict[str, Any]:
    """Build a Payslip data dict."""
    return {
        "employer": employer,
        "employee": employee,
        "pay_period": pay_period,
        "pay_date": pay_date,
        "earnings": earnings,
        "deductions": deductions,
        "gross_pay": gross_pay,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "ytd_gross": ytd_gross,
        "ytd_tax": ytd_tax,
    }


def to_pdf(slip: dict[str, Any]) -> bytes:
    """Generate a Payslip PDF as bytes."""
    fpdf = _require_fpdf2()
    pdf = fpdf.FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # -- Employer header --
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 8, slip["employer"]["name"],
             new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, slip["employer"]["address"],
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {slip['employer']['tin']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # -- PAYSLIP banner --
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(CONTENT_WIDTH, 10, "PAYSLIP", fill=True, align="C",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # -- Employee details --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Employee Details:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(0, 4, f"Name: {slip['employee']['name']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Employee ID: {slip['employee']['employee_id']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"TIN: {slip['employee']['tin']}",
             new_x="LMARGIN", new_y="NEXT")
    if slip["employee"].get("department"):
        pdf.cell(0, 4, f"Department: {slip['employee']['department']}",
                 new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Pay Period: {slip['pay_period']}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"Pay Date: {format_date(slip['pay_date'])}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    col_label = 110
    col_amount = 70

    # -- Earnings table --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Earnings", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    pdf.set_fill_color(*COLOR_HEADER_BG)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(col_label, 6, "Description", fill=True, align="L")
    pdf.cell(col_amount, 6, "Amount", fill=True, align="R")
    pdf.ln()

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    for item in slip["earnings"]:
        pdf.cell(col_label, 5, item["label"], align="L")
        pdf.cell(col_amount, 5, _cur(item["amount"]), align="R")
        pdf.ln()
        pdf.set_draw_color(*COLOR_LINE)
        pdf.line(pdf.l_margin, pdf.get_y(),
                 pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
        pdf.ln(1)

    # Gross pay total
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(col_label, 6, "Gross Pay", align="L")
    pdf.cell(col_amount, 6, _cur(slip["gross_pay"]), align="R")
    pdf.ln()
    pdf.ln(4)

    # -- Deductions table --
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(0, 5, "Deductions", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    pdf.set_fill_color(*COLOR_HEADER_BG)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(col_label, 6, "Description", fill=True, align="L")
    pdf.cell(col_amount, 6, "Amount", fill=True, align="R")
    pdf.ln()

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*COLOR_SECONDARY)
    for item in slip["deductions"]:
        pdf.cell(col_label, 5, item["label"], align="L")
        pdf.cell(col_amount, 5, _cur(item["amount"]), align="R")
        pdf.ln()
        pdf.set_draw_color(*COLOR_LINE)
        pdf.line(pdf.l_margin, pdf.get_y(),
                 pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
        pdf.ln(1)

    # Total deductions
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*COLOR_PRIMARY)
    pdf.cell(col_label, 6, "Total Deductions", align="L")
    pdf.cell(col_amount, 6, _cur(slip["total_deductions"]), align="R")
    pdf.ln()
    pdf.ln(6)

    # -- Net Pay highlighted --
    pdf.set_fill_color(*COLOR_PRIMARY)
    pdf.set_text_color(*COLOR_WHITE)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(col_label, 10, "  NET PAY", fill=True, align="L")
    pdf.cell(col_amount, 10, f"{_cur(slip['net_pay'])}  ", fill=True,
             align="R")
    pdf.ln()
    pdf.ln(6)

    # -- YTD section (optional) --
    if slip.get("ytd_gross") is not None or slip.get("ytd_tax") is not None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, 5, "Year-to-Date Summary",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*COLOR_SECONDARY)
        if slip.get("ytd_gross") is not None:
            pdf.cell(col_label, 5, "YTD Gross Pay", align="L")
            pdf.cell(col_amount, 5, _cur(slip["ytd_gross"]), align="R")
            pdf.ln()
        if slip.get("ytd_tax") is not None:
            pdf.cell(col_label, 5, "YTD Tax Deducted", align="L")
            pdf.cell(col_amount, 5, _cur(slip["ytd_tax"]), align="R")
            pdf.ln()
        pdf.ln(4)

    # -- Footer --
    pdf.set_draw_color(*COLOR_LINE)
    pdf.line(pdf.l_margin, pdf.get_y(),
             pdf.l_margin + CONTENT_WIDTH, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*COLOR_SECONDARY)
    pdf.cell(CONTENT_WIDTH, 3,
             f"Generated by ngtaxkit -- Payslip | {slip['pay_period']} | {slip['employee']['employee_id']}",
             align="C")

    return pdf.output()
