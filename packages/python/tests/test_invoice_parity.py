"""Cross-language parity tests for invoice module."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ngtaxkit import invoice
from ngtaxkit.errors import EmptyInvoiceError, InvalidAmountError, InvalidQuantityError

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures"


def _load_fixture(name: str) -> list[dict]:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


INVOICE_FIXTURES = _load_fixture("invoice_test_cases.json")


class TestInvoiceParity:
    @pytest.mark.parametrize(
        "tc", [tc for tc in INVOICE_FIXTURES if "expected" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_invoice_expected(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]

        items = [
            {
                "description": it["description"],
                "quantity": it["quantity"],
                "unit_price": it["unitPrice"],
                **({"category": it["category"]} if "category" in it else {}),
            }
            for it in inp["items"]
        ]

        inv = invoice.create(
            seller=inp["seller"],
            buyer=inp["buyer"],
            items=items,
            invoice_number=inp["invoiceNumber"],
            issue_date=inp.get("issueDate", "2026-04-06"),
            due_date=inp.get("dueDate"),
            purchase_order_ref=inp.get("purchaseOrderRef"),
            notes=inp.get("notes"),
            type=inp.get("type", "invoice"),
        )

        assert inv["subtotal"] == exp["subtotal"]
        assert inv["total_vat"] == exp["totalVat"]
        assert inv["total"] == exp["total"]
        assert inv["validation"]["valid"] == exp["validation"]["valid"]
        assert inv["ubl_field_count"] == exp["ublFieldCount"]

        for i, item_exp in enumerate(exp["items"]):
            item = inv["items"][i]
            assert item["vat_rate"] == item_exp["vatRate"]
            assert item["vat_amount"] == item_exp["vatAmount"]
            assert item["line_net"] == item_exp["lineNet"]
            assert item["line_total"] == item_exp["lineTotal"]

    @pytest.mark.parametrize(
        "tc", [tc for tc in INVOICE_FIXTURES if "expectedError" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_invoice_errors(self, tc: dict) -> None:
        inp = tc["input"]
        code = tc["expectedError"]["code"]
        err_map = {
            "NGTK_EMPTY_INVOICE": EmptyInvoiceError,
            "NGTK_INVALID_AMOUNT": InvalidAmountError,
            "NGTK_INVALID_QUANTITY": InvalidQuantityError,
        }
        items = [
            {
                "description": it["description"],
                "quantity": it["quantity"],
                "unit_price": it["unitPrice"],
                **({"category": it["category"]} if "category" in it else {}),
            }
            for it in inp.get("items", [])
        ]
        with pytest.raises(err_map[code]):
            invoice.create(
                seller=inp["seller"],
                buyer=inp["buyer"],
                items=items,
                invoice_number=inp.get("invoiceNumber", "TEST"),
            )
