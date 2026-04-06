"""Unit tests for the invoice module."""

from __future__ import annotations

import json

import pytest

from ngtaxkit import invoice
from ngtaxkit.errors import EmptyInvoiceError, InvalidAmountError, InvalidQuantityError


SELLER = {"name": "Acme Ltd", "tin": "12345678-0001", "address": "123 Marina, Lagos"}
BUYER = {"name": "Buyer Co", "tin": "87654321-0001", "address": "45 Wuse, Abuja"}


class TestCreate:
    def test_single_standard_item(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001",
        )
        assert inv["subtotal"] == 100_000
        assert inv["total_vat"] == 7_500
        assert inv["total"] == 107_500
        assert len(inv["items"]) == 1
        assert inv["items"][0]["vat_rate"] == 0.075
        assert inv["items"][0]["vat_amount"] == 7_500
        assert inv["items"][0]["line_net"] == 100_000
        assert inv["items"][0]["line_total"] == 107_500
        assert inv["currency"] == "NGN"
        assert inv["type"] == "invoice"

    def test_zero_rated_item(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Rice", "quantity": 10, "unit_price": 5_000, "category": "basic-food"}],
            invoice_number="INV-002",
        )
        assert inv["total_vat"] == 0
        assert inv["total"] == 50_000
        assert inv["items"][0]["vat_rate"] == 0
        assert inv["items"][0]["vat_amount"] == 0

    def test_mixed_categories(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[
                {"description": "Consulting", "quantity": 1, "unit_price": 100_000},
                {"description": "Rice", "quantity": 10, "unit_price": 5_000, "category": "basic-food"},
            ],
            invoice_number="INV-003",
        )
        assert inv["subtotal"] == 150_000
        assert inv["total_vat"] == 7_500
        assert inv["total"] == 157_500
        assert len(inv["vat_breakdown"]) == 2

    def test_credit_note(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Refund", "quantity": 1, "unit_price": 50_000}],
            invoice_number="CN-001",
            type="credit-note",
        )
        assert inv["type"] == "credit-note"

    def test_empty_items_raises(self) -> None:
        with pytest.raises(EmptyInvoiceError):
            invoice.create(seller=SELLER, buyer=BUYER, items=[], invoice_number="INV-X")

    def test_negative_price_raises(self) -> None:
        with pytest.raises(InvalidAmountError):
            invoice.create(
                seller=SELLER,
                buyer=BUYER,
                items=[{"description": "Bad", "quantity": 1, "unit_price": -100}],
                invoice_number="INV-X",
            )

    def test_zero_quantity_raises(self) -> None:
        with pytest.raises(InvalidQuantityError):
            invoice.create(
                seller=SELLER,
                buyer=BUYER,
                items=[{"description": "Bad", "quantity": 0, "unit_price": 100}],
                invoice_number="INV-X",
            )


class TestValidate:
    def test_valid_invoice(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001",
        )
        result = invoice.validate(inv)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_missing_invoice_number(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001",
        )
        inv["invoice_number"] = ""
        result = invoice.validate(inv)
        assert result["valid"] is False
        assert any(e["field"] == "invoice_number" for e in result["errors"])


class TestToFirsJson:
    def test_produces_valid_json(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001",
        )
        result = invoice.to_firs_json(inv)
        parsed = json.loads(result)
        assert parsed["invoiceNumber"] == "INV-001"
        assert parsed["subtotal"] == 100_000
        assert parsed["totalVat"] == 7_500
        assert parsed["total"] == 107_500
        assert len(parsed["items"]) == 1

    def test_deterministic(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001",
            issue_date="2026-04-06",
        )
        assert invoice.to_firs_json(inv) == invoice.to_firs_json(inv)


class TestToCsv:
    def test_single_invoice(self) -> None:
        inv = invoice.create(
            seller=SELLER,
            buyer=BUYER,
            items=[{"description": "Consulting", "quantity": 1, "unit_price": 100_000}],
            invoice_number="INV-001",
            issue_date="2026-04-06",
        )
        csv = invoice.to_csv([inv])
        lines = csv.strip().split("\n")
        assert len(lines) == 2
        assert lines[0] == "Invoice Number,Date,Buyer,Seller,Subtotal,VAT,Total,Status"
        assert "INV-001" in lines[1]
        assert "valid" in lines[1]
