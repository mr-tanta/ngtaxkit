"""Smoke test an installed ngtaxkit wheel from outside the repo package path."""

from __future__ import annotations

import json

from ngtaxkit import rates, tools, vat

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

print(json.dumps({
    "vat": vat_trace["result"]["vat"],
    "tool_vat": tool_trace["result"]["vat"],
    "source": source["source_title"],
    "total_keys": audit["total_keys"],
}))
