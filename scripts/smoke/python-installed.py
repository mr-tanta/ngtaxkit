"""Smoke test an installed ngtaxkit wheel from outside the repo package path."""

from __future__ import annotations

import json

from ngtaxkit import errors, pension, rates, tools, vat, wht

vat_trace = vat.explain_calculate(amount=100_000.0, category="standard")
tool_trace = tools.call_tool(
    "ngtaxkit.vat.explain_calculate",
    {"amount": 100_000.0, "category": "standard"},
)
source = rates.explain("vat.standard.rate")
audit = rates.audit()

if vat_trace["result"]["vat"] != 7_500.0:
    raise RuntimeError(f'Expected VAT 7500, got {vat_trace["result"]["vat"]}')
if tool_trace["result"]["vat"] != 7_500.0:
    raise RuntimeError(f'Expected tool VAT 7500, got {tool_trace["result"]["vat"]}')
if source["source_title"] != "Nigeria Tax Act, 2025":
    raise RuntimeError(f'Unexpected VAT source title: {source["source_title"]}')
if audit["total_keys"] <= 0:
    raise RuntimeError("Expected rate audit to report bundled rate keys")

for description, callback in [
    ("VAT invalid date", lambda: vat.calculate(amount=100.0, date="bad-date")),
    (
        "WHT invalid payment date",
        lambda: wht.calculate(
            amount=100.0,
            payee_type="individual",
            service_type="professional",
            payment_date="bad-date",
        ),
    ),
    (
        "Pension invalid salary payment date",
        lambda: pension.calculate(basic_salary=100.0, salary_payment_date="bad-date"),
    ),
]:
    try:
        callback()
    except errors.InvalidDateError:
        continue
    raise RuntimeError(f"Expected InvalidDateError for {description}")

print(json.dumps({
    "vat": vat_trace["result"]["vat"],
    "tool_vat": tool_trace["result"]["vat"],
    "source": source["source_title"],
    "total_keys": audit["total_keys"],
}))
