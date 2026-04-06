"""Unit tests for UBL 3.0 XML generation."""

from __future__ import annotations

from ngtaxkit import invoice, ubl


SELLER = {"name": "Acme Ltd", "tin": "12345678-0001", "address": "123 Marina, Lagos"}
BUYER = {"name": "Buyer Co", "tin": "87654321-0001", "address": "45 Wuse, Abuja"}


class TestToUbl:
    def test_contains_xml_declaration(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        xml = ubl.to_ubl(inv)
        assert xml.startswith('<?xml version="1.0" encoding="UTF-8"?>')

    def test_contains_invoice_number(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        xml = ubl.to_ubl(inv)
        assert "<cbc:ID>INV-001</cbc:ID>" in xml

    def test_type_code_invoice(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Test", "quantity": 1, "unit_price": 1000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        xml = ubl.to_ubl(inv)
        assert "<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>" in xml

    def test_type_code_credit_note(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Refund", "quantity": 1, "unit_price": 1000}],
            invoice_number="CN-001", issue_date="2026-04-06", type="credit-note",
        )
        xml = ubl.to_ubl(inv)
        assert "<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>" in xml

    def test_xml_escaping(self) -> None:
        seller = {"name": "A&B <Corp>", "tin": "123", "address": "Addr"}
        inv = invoice.create(
            seller=seller, buyer=BUYER,
            items=[{"description": "Test", "quantity": 1, "unit_price": 1000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        xml = ubl.to_ubl(inv)
        assert "A&amp;B &lt;Corp&gt;" in xml

    def test_deterministic(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Test", "quantity": 1, "unit_price": 1000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        assert ubl.to_ubl(inv) == ubl.to_ubl(inv)

    def test_contains_seller_and_buyer(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Test", "quantity": 1, "unit_price": 1000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        xml = ubl.to_ubl(inv)
        assert "AccountingSupplierParty" in xml
        assert "AccountingCustomerParty" in xml
        assert "Acme Ltd" in xml
        assert "Buyer Co" in xml

    def test_contains_tax_totals(self) -> None:
        inv = invoice.create(
            seller=SELLER, buyer=BUYER,
            items=[{"description": "Test", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001", issue_date="2026-04-06",
        )
        xml = ubl.to_ubl(inv)
        assert "TaxTotal" in xml
        assert "LegalMonetaryTotal" in xml
        assert "7500.00" in xml
