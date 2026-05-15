"""Tests for tool schemas and dispatcher."""

from __future__ import annotations

import pytest

from ngtaxkit import errors, tools


def test_get_tool_schemas_exposes_source_backed_calculators() -> None:
    schemas = tools.get_tool_schemas()
    names = {schema["name"] for schema in schemas}

    assert {
        "ngtaxkit.vat.explain_calculate",
        "ngtaxkit.paye.explain_calculate",
        "ngtaxkit.wht.explain_calculate",
        "ngtaxkit.rates.explain",
        "ngtaxkit.rates.audit",
    }.issubset(names)
    vat_schema = next(schema for schema in schemas if schema["name"] == "ngtaxkit.vat.explain_calculate")
    assert "amount" in vat_schema["input_schema"]["required"]


def test_call_tool_runs_vat_explanation() -> None:
    result = tools.call_tool(
        "ngtaxkit.vat.explain_calculate",
        {"amount": 100_000.0, "category": "standard"},
    )

    assert result["result"]["vat"] == 7_500.0
    assert result["rate_keys"] == ["vat.standard.rate"]


def test_call_tool_runs_rate_explanation() -> None:
    result = tools.call_tool("ngtaxkit.rates.explain", {"key": "vat.standard.rate"})

    assert result["key"] == "vat.standard.rate"
    assert result["value"] == 0.075
    assert result["source_title"] == "Nigeria Tax Act, 2025"


def test_call_tool_rejects_unknown_tool() -> None:
    with pytest.raises(errors.ValidationError):
        tools.call_tool("ngtaxkit.nope", {})


def test_get_openapi_spec_exports_http_wrapper_shape() -> None:
    spec = tools.get_openapi_spec()

    assert spec["openapi"] == "3.1.0"
    assert "/vat/explain-calculate" in spec["paths"]
    assert (
        spec["paths"]["/vat/explain-calculate"]["post"]["operation_id"]
        == "ngtaxkit.vat.explain_calculate"
    )
