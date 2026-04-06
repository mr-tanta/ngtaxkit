"""Smoke tests for PDF generators — verify they produce valid PDF bytes."""

from __future__ import annotations

import pytest

fpdf2 = pytest.importorskip("fpdf")

from ngtaxkit import invoice
from ngtaxkit.pdf import invoice_pdf, wht_credit_note, form_h1, payslip, vat_return


SELLER = {"name": "Acme Ltd", "tin": "12345678-0001", "address": "Lagos"}
BUYER = {"name": "Buyer Co", "tin": "87654321-0001", "address": "Abuja"}


class TestInvoicePdf:
    def test_produces_pdf_bytes(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        result = invoice_pdf.to_pdf(inv)
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"


class TestWhtCreditNote:
    def test_produces_pdf_bytes(self) -> None:
        note = wht_credit_note.create(
            deductor={"name": "Payer Ltd", "tin": "111-0001", "address": "Lagos"},
            beneficiary={"name": "Payee Ltd", "tin": "222-0001", "address": "Abuja"},
            gross_amount=500_000, wht_rate=0.1, wht_amount=50_000, net_payment=450_000,
            service_description="Professional services", payment_date="2026-04-06",
            credit_note_number="WHT-001",
        )
        result = wht_credit_note.to_pdf(note)
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"


class TestFormH1:
    def test_produces_pdf_bytes(self) -> None:
        form = form_h1.create(
            employer={"name": "Corp Ltd", "tin": "333-0001", "address": "Lagos"},
            tax_year=2026, state="Lagos", state_irs_name="LIRS",
            employees=[{
                "serial_number": 1, "name": "Amina", "tin": "444-0001",
                "gross_income": 4_000_000, "reliefs": 500_000,
                "taxable_income": 3_500_000, "tax_deducted": 350_000,
            }],
            total_gross=4_000_000, total_tax=350_000,
        )
        result = form_h1.to_pdf(form)
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"


class TestPayslip:
    def test_produces_pdf_bytes(self) -> None:
        slip = payslip.create(
            employer={"name": "Corp Ltd", "address": "Lagos", "tin": "333-0001"},
            employee={"name": "Amina", "employee_id": "EMP-001", "tin": "444-0001"},
            pay_period="April 2026", pay_date="2026-04-30",
            earnings=[{"label": "Basic Salary", "amount": 300_000}],
            deductions=[{"label": "PAYE", "amount": 25_000}, {"label": "Pension", "amount": 24_000}],
            gross_pay=300_000, total_deductions=49_000, net_pay=251_000,
        )
        result = payslip.to_pdf(slip)
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"


class TestVatReturn:
    def test_produces_pdf_bytes(self) -> None:
        ret = vat_return.create(
            period="2026-04", business_name="Acme Ltd",
            business_tin="12345678-0001", business_vrn="VRN-001",
            sales_invoices=[
                {"invoice_number": "INV-001", "amount": 100_000, "vat_amount": 7_500, "rate_type": "standard"},
            ],
        )
        result = vat_return.to_pdf(ret)
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"
