"""Cross-language parity tests for UBL XML generation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ngtaxkit import invoice, ubl

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures"


def _load_fixture(name: str) -> list[dict]:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


UBL_FIXTURES = _load_fixture("ubl_test_cases.json")


class TestUblParity:
    @pytest.mark.parametrize(
        "tc", UBL_FIXTURES, ids=lambda tc: tc["description"],
    )
    def test_ubl_output_matches(self, tc: dict) -> None:
        inp = tc["input"]
        expected_xml = tc["expected"]

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
            issue_date=inp["issueDate"],
            due_date=inp.get("dueDate"),
            purchase_order_ref=inp.get("purchaseOrderRef"),
            notes=inp.get("notes"),
            type=inp.get("type", "invoice"),
        )

        result = ubl.to_ubl(inv)
        assert result == expected_xml
