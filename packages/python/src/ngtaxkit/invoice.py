"""Invoice module (Layer 2) — create, validate, and export invoices."""

from __future__ import annotations

import datetime
import json
from typing import Any

from . import vat as vat_module
from .errors import EmptyInvoiceError, InvalidAmountError, InvalidQuantityError
from .utils import bankers_round


def create(
    *,
    seller: dict[str, Any],
    buyer: dict[str, Any],
    items: list[dict[str, Any]],
    invoice_number: str,
    currency: str = "NGN",
    issue_date: str | None = None,
    due_date: str | None = None,
    purchase_order_ref: str | None = None,
    notes: str | None = None,
    type: str = "invoice",
) -> dict[str, Any]:
    """Create an invoice with auto-calculated VAT per line item."""
    if not items:
        raise EmptyInvoiceError("Invoice must have at least one line item")

    for i, item in enumerate(items):
        unit_price = item.get("unit_price", 0)
        if unit_price < 0:
            raise InvalidAmountError(f"Line item {i + 1} has negative unit price: {unit_price}")
        qty = item.get("quantity", 0)
        if qty <= 0:
            raise InvalidQuantityError(f"Line item {i + 1} has zero or negative quantity: {qty}")

    if issue_date is None:
        issue_date = datetime.date.today().isoformat()

    computed_items: list[dict[str, Any]] = []
    for item in items:
        category = item.get("category", "standard")
        unit_price = item.get("unit_price", 0)
        quantity = item["quantity"]
        line_net = bankers_round(quantity * unit_price)
        vat_result = vat_module.calculate(amount=line_net, category=category)
        computed_items.append({
            "description": item["description"],
            "quantity": quantity,
            "unit_price": unit_price,
            "category": category,
            "vat_rate": vat_result["rate"],
            "vat_amount": vat_result["vat"],
            "line_net": line_net,
            "line_total": bankers_round(line_net + vat_result["vat"]),
        })

    subtotal = bankers_round(sum(it["line_net"] for it in computed_items))
    total_vat = bankers_round(sum(it["vat_amount"] for it in computed_items))
    total = bankers_round(subtotal + total_vat)

    breakdown_map: dict[float, dict[str, Any]] = {}
    for it in computed_items:
        rate = it["vat_rate"]
        if rate in breakdown_map:
            breakdown_map[rate]["taxable_amount"] = bankers_round(
                breakdown_map[rate]["taxable_amount"] + it["line_net"]
            )
            breakdown_map[rate]["vat_amount"] = bankers_round(
                breakdown_map[rate]["vat_amount"] + it["vat_amount"]
            )
        else:
            vr = vat_module.calculate(amount=100, category=it["category"])
            breakdown_map[rate] = {
                "rate_type": vr["rate_type"],
                "taxable_amount": it["line_net"],
                "vat_amount": it["vat_amount"],
            }

    vat_breakdown = [
        {"rate": rate, "rate_type": d["rate_type"], "taxable_amount": d["taxable_amount"], "vat_amount": d["vat_amount"]}
        for rate, d in breakdown_map.items()
    ]

    inv: dict[str, Any] = {
        "type": type,
        "invoice_number": invoice_number,
        "issue_date": issue_date,
        "due_date": due_date,
        "currency": currency,
        "seller": seller,
        "buyer": buyer,
        "items": computed_items,
        "subtotal": subtotal,
        "total_vat": total_vat,
        "total": total,
        "vat_breakdown": vat_breakdown,
        "purchase_order_ref": purchase_order_ref,
        "notes": notes,
        "validation": {"valid": True, "errors": []},
        "ubl_field_count": 0,
    }

    inv["validation"] = validate(inv)
    inv["ubl_field_count"] = _count_ubl_fields(inv)
    return inv


def validate(inv: dict[str, Any]) -> dict[str, Any]:
    """Validate invoice against UBL 3.0 mandatory fields."""
    errors: list[dict[str, str]] = []

    if not inv.get("invoice_number", "").strip():
        errors.append({"field": "invoice_number", "message": "Invoice number is required"})
    if not inv.get("issue_date", "").strip():
        errors.append({"field": "issue_date", "message": "Issue date is required"})
    if not inv.get("currency", "").strip():
        errors.append({"field": "currency", "message": "Currency code is required"})
    if inv.get("type") not in ("invoice", "credit-note", "debit-note"):
        errors.append({"field": "type", "message": "Invoice type must be invoice, credit-note, or debit-note"})

    seller = inv.get("seller")
    if not seller:
        errors.append({"field": "seller", "message": "Seller details are required"})
    else:
        if not seller.get("name", "").strip():
            errors.append({"field": "seller.name", "message": "Seller name is required"})
        if not seller.get("tin", "").strip():
            errors.append({"field": "seller.tin", "message": "Seller TIN is required"})
        if not seller.get("address", "").strip():
            errors.append({"field": "seller.address", "message": "Seller address is required"})

    buyer = inv.get("buyer")
    if not buyer:
        errors.append({"field": "buyer", "message": "Buyer details are required"})
    else:
        if not buyer.get("name", "").strip():
            errors.append({"field": "buyer.name", "message": "Buyer name is required"})
        if not buyer.get("tin", "").strip():
            errors.append({"field": "buyer.tin", "message": "Buyer TIN is required"})
        if not buyer.get("address", "").strip():
            errors.append({"field": "buyer.address", "message": "Buyer address is required"})

    items = inv.get("items", [])
    if not items:
        errors.append({"field": "items", "message": "At least one line item is required"})
    else:
        for i, item in enumerate(items):
            prefix = f"items[{i}]"
            if not item.get("description", "").strip():
                errors.append({"field": f"{prefix}.description", "message": f"Line item {i + 1} description is required"})
            if item.get("quantity") is None or item["quantity"] <= 0:
                errors.append({"field": f"{prefix}.quantity", "message": f"Line item {i + 1} quantity must be positive"})
            if item.get("unit_price") is None or item["unit_price"] < 0:
                errors.append({"field": f"{prefix}.unit_price", "message": f"Line item {i + 1} unit price must be non-negative"})
            if item.get("vat_rate") is None:
                errors.append({"field": f"{prefix}.vat_rate", "message": f"Line item {i + 1} VAT rate is required"})
            if item.get("vat_amount") is None:
                errors.append({"field": f"{prefix}.vat_amount", "message": f"Line item {i + 1} VAT amount is required"})
            if item.get("line_net") is None:
                errors.append({"field": f"{prefix}.line_net", "message": f"Line item {i + 1} line net amount is required"})
            if item.get("line_total") is None:
                errors.append({"field": f"{prefix}.line_total", "message": f"Line item {i + 1} line total is required"})

    if inv.get("subtotal") is None:
        errors.append({"field": "subtotal", "message": "Subtotal is required"})
    if inv.get("total_vat") is None:
        errors.append({"field": "total_vat", "message": "Total VAT is required"})
    if inv.get("total") is None:
        errors.append({"field": "total", "message": "Total is required"})

    vat_breakdown = inv.get("vat_breakdown", [])
    if not vat_breakdown:
        errors.append({"field": "vat_breakdown", "message": "VAT breakdown is required"})
    else:
        for i, entry in enumerate(vat_breakdown):
            prefix = f"vat_breakdown[{i}]"
            if entry.get("rate") is None:
                errors.append({"field": f"{prefix}.rate", "message": f"VAT breakdown entry {i + 1} rate is required"})
            if entry.get("rate_type") is None:
                errors.append({"field": f"{prefix}.rate_type", "message": f"VAT breakdown entry {i + 1} rate type is required"})
            if entry.get("taxable_amount") is None:
                errors.append({"field": f"{prefix}.taxable_amount", "message": f"VAT breakdown entry {i + 1} taxable amount is required"})
            if entry.get("vat_amount") is None:
                errors.append({"field": f"{prefix}.vat_amount", "message": f"VAT breakdown entry {i + 1} VAT amount is required"})

    return {"valid": len(errors) == 0, "errors": errors}


def to_firs_json(inv: dict[str, Any]) -> str:
    """Generate FIRS-compatible JSON. Deterministic (sorted keys)."""
    obj = {
        "buyer": {
            "address": inv["buyer"]["address"],
            "name": inv["buyer"]["name"],
            "tin": inv["buyer"]["tin"],
            "vrn": inv["buyer"].get("vrn"),
        },
        "currency": inv["currency"],
        "dueDate": inv.get("due_date"),
        "invoiceNumber": inv["invoice_number"],
        "invoiceType": inv["type"],
        "issueDate": inv["issue_date"],
        "items": [
            {
                "category": it.get("category", "standard"),
                "description": it["description"],
                "lineId": i + 1,
                "lineNet": it["line_net"],
                "lineTotal": it["line_total"],
                "quantity": it["quantity"],
                "unitPrice": it["unit_price"],
                "vatAmount": it["vat_amount"],
                "vatRate": it["vat_rate"],
            }
            for i, it in enumerate(inv["items"])
        ],
        "notes": inv.get("notes"),
        "purchaseOrderRef": inv.get("purchase_order_ref"),
        "seller": {
            "address": inv["seller"]["address"],
            "name": inv["seller"]["name"],
            "tin": inv["seller"]["tin"],
            "vrn": inv["seller"].get("vrn"),
        },
        "subtotal": inv["subtotal"],
        "total": inv["total"],
        "totalVat": inv["total_vat"],
        "ublFieldCount": inv["ubl_field_count"],
        "validation": {
            "errors": inv["validation"]["errors"],
            "valid": inv["validation"]["valid"],
        },
        "vatBreakdown": [
            {
                "rate": e["rate"],
                "rateType": e["rate_type"],
                "taxableAmount": e["taxable_amount"],
                "vatAmount": e["vat_amount"],
            }
            for e in inv["vat_breakdown"]
        ],
    }
    return json.dumps(obj, indent=2, sort_keys=True)


def to_csv(invoices: list[dict[str, Any]]) -> str:
    """Generate CSV string with one row per invoice."""
    header = "Invoice Number,Date,Buyer,Seller,Subtotal,VAT,Total,Status"
    rows: list[str] = []
    for inv in invoices:
        status = "valid" if inv["validation"]["valid"] else "invalid"
        rows.append(",".join([
            _csv_escape(inv["invoice_number"]),
            _csv_escape(inv["issue_date"]),
            _csv_escape(inv["buyer"]["name"]),
            _csv_escape(inv["seller"]["name"]),
            f'{inv["subtotal"]:.2f}',
            f'{inv["total_vat"]:.2f}',
            f'{inv["total"]:.2f}',
            status,
        ]))
    return "\n".join([header, *rows])


def _csv_escape(value: str) -> str:
    if "," in value or '"' in value or "\n" in value:
        return f'"{value.replace(chr(34), chr(34) + chr(34))}"'
    return value


def _count_ubl_fields(inv: dict[str, Any]) -> int:
    count = 0
    for key in ("invoice_number", "issue_date", "currency", "type", "due_date", "purchase_order_ref", "notes"):
        if inv.get(key):
            count += 1
    for key in ("subtotal", "total_vat", "total"):
        if inv.get(key) is not None:
            count += 1

    for party_key in ("seller", "buyer"):
        party = inv.get(party_key, {})
        for key in ("name", "tin", "address", "vrn"):
            if party.get(key):
                count += 1

    for item in inv.get("items", []):
        for key in ("description", "quantity", "unit_price", "vat_rate", "vat_amount", "line_net", "line_total"):
            if item.get(key) is not None:
                count += 1

    for entry in inv.get("vat_breakdown", []):
        for key in ("rate", "rate_type", "taxable_amount", "vat_amount"):
            if entry.get(key) is not None:
                count += 1

    return count
