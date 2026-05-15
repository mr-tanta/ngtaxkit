"""Zero-dependency tool schemas and dispatcher for ngtaxkit."""

from __future__ import annotations

import math
from typing import Any

from . import paye, rates, vat, wht
from .errors import ValidationError
from .types import OpenApiSpec, ToolSchema

ToolName = str

_EXPLANATION_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": True,
    "properties": {
        "result": {"type": "object", "additionalProperties": True},
        "formula": {"type": "array", "items": {"type": "string"}},
        "rate_keys": {"type": "array", "items": {"type": "string"}},
        "sources": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
}

_RATE_SOURCE_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": True,
    "properties": {
        "key": {"type": "string"},
        "value": {},
        "source_title": {"type": "string"},
        "source_url": {"type": "string"},
        "legal_basis": {"type": "string"},
    },
}

_TOOLS: list[ToolSchema] = [
    {
        "name": "ngtaxkit.vat.explain_calculate",
        "description": "Calculate Nigerian VAT and return formula steps, rate keys, source metadata, and warnings.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["amount"],
            "properties": {
                "amount": {"type": "number", "description": "Naira amount."},
                "inclusive": {"type": "boolean", "description": "True when amount already includes VAT."},
                "category": {"type": "string", "description": "VAT category. Defaults to standard."},
                "date": {"type": "string", "description": "Optional ISO date for rate-regime selection."},
            },
        },
        "output_schema": _EXPLANATION_OUTPUT_SCHEMA,
    },
    {
        "name": "ngtaxkit.paye.explain_calculate",
        "description": "Calculate Nigerian PAYE and return formula steps, rate keys, source metadata, and warnings.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["gross_annual"],
            "properties": {
                "gross_annual": {"type": "number", "description": "Annual gross income in naira."},
                "pension_contributing": {"type": "boolean"},
                "nhf_contributing": {"type": "boolean"},
                "rent_paid_annual": {"type": "number"},
                "disability_status": {"type": "boolean"},
                "tax_year": {"type": "number"},
            },
        },
        "output_schema": _EXPLANATION_OUTPUT_SCHEMA,
    },
    {
        "name": "ngtaxkit.wht.explain_calculate",
        "description": "Calculate Nigerian WHT and return formula steps, rate keys, source metadata, and warnings.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["amount", "payee_type", "service_type"],
            "properties": {
                "amount": {"type": "number", "description": "Gross payment amount in naira."},
                "payee_type": {"type": "string", "enum": ["individual", "company"]},
                "service_type": {"type": "string"},
                "payee_is_small_company": {"type": "boolean"},
                "payee_tin": {"type": "string"},
                "payment_date": {"type": "string", "description": "ISO payment date used for remittance deadline."},
            },
        },
        "output_schema": _EXPLANATION_OUTPUT_SCHEMA,
    },
    {
        "name": "ngtaxkit.rates.explain",
        "description": "Explain a bundled rate key with source metadata.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["key"],
            "properties": {
                "key": {"type": "string", "description": "Dot-path rate key, for example vat.standard.rate."},
            },
        },
        "output_schema": _RATE_SOURCE_OUTPUT_SCHEMA,
    },
    {
        "name": "ngtaxkit.rates.audit",
        "description": "Audit bundled rate source metadata coverage.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {},
        },
        "output_schema": {
            "type": "object",
            "additionalProperties": True,
            "properties": {
                "version": {"type": "string"},
                "total_keys": {"type": "number"},
                "missing_metadata": {"type": "array", "items": {"type": "string"}},
            },
        },
    },
]


def get_tool_schemas() -> list[ToolSchema]:
    """Return JSON Schema-compatible tool definitions."""
    return _TOOLS


def get_openapi_spec() -> OpenApiSpec:
    """Return a minimal OpenAPI spec for wrapping the tools over HTTP."""
    return OpenApiSpec(
        openapi="3.1.0",
        info={"title": "ngtaxkit Tool API", "version": rates.get_version()},
        paths=dict([
            _openapi_path("/vat/explain-calculate", _TOOLS[0]),
            _openapi_path("/paye/explain-calculate", _TOOLS[1]),
            _openapi_path("/wht/explain-calculate", _TOOLS[2]),
            _openapi_path("/rates/explain", _TOOLS[3]),
            _openapi_path("/rates/audit", _TOOLS[4]),
        ]),
    )


def call_tool(name: str, input_data: dict[str, Any]) -> Any:
    """Call a registered ngtaxkit tool with structured input."""
    if name == "ngtaxkit.vat.explain_calculate":
        return vat.explain_calculate(
            amount=_require_number(input_data, "amount"),
            inclusive=_optional_bool(input_data, "inclusive") or False,
            category=_optional_string(input_data, "category") or "standard",
            date=_optional_string(input_data, "date"),
        )
    if name == "ngtaxkit.paye.explain_calculate":
        return paye.explain_calculate(
            gross_annual=_require_number(input_data, "gross_annual"),
            pension_contributing=_optional_bool(input_data, "pension_contributing") or False,
            nhf_contributing=_optional_bool(input_data, "nhf_contributing") or False,
            rent_paid_annual=_optional_number(input_data, "rent_paid_annual") or 0.0,
            disability_status=_optional_bool(input_data, "disability_status") or False,
            tax_year=_optional_int(input_data, "tax_year"),
        )
    if name == "ngtaxkit.wht.explain_calculate":
        return wht.explain_calculate(
            amount=_require_number(input_data, "amount"),
            payee_type=_require_string(input_data, "payee_type"),
            service_type=_require_string(input_data, "service_type"),
            payee_is_small_company=_optional_bool(input_data, "payee_is_small_company") or False,
            payee_tin=_optional_string(input_data, "payee_tin"),
            payment_date=_optional_string(input_data, "payment_date"),
        )
    if name == "ngtaxkit.rates.explain":
        return rates.explain(_require_string(input_data, "key"))
    if name == "ngtaxkit.rates.audit":
        return rates.audit()

    raise ValidationError(
        f'Unknown ngtaxkit tool "{name}"',
        [{"field": "name", "message": "Tool name is not registered"}],
    )


def _openapi_path(path: str, tool: ToolSchema) -> tuple[str, dict[str, Any]]:
    return path, {
        "post": {
            "operation_id": tool["name"],
            "summary": tool["description"],
            "request_body": {
                "required": True,
                "content": {"application/json": {"schema": tool["input_schema"]}},
            },
            "responses": {
                "200": {
                    "description": "Tool result",
                    "content": {"application/json": {"schema": tool["output_schema"]}},
                }
            },
        }
    }


def _require_number(input_data: dict[str, Any], field: str) -> float:
    value = input_data.get(field)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise ValidationError(
            f'Field "{field}" must be a finite number',
            [{"field": field, "message": "Expected finite number"}],
        )
    return float(value)


def _optional_number(input_data: dict[str, Any], field: str) -> float | None:
    if field not in input_data:
        return None
    return _require_number(input_data, field)


def _optional_int(input_data: dict[str, Any], field: str) -> int | None:
    value = _optional_number(input_data, field)
    if value is None:
        return None
    if not value.is_integer():
        raise ValidationError(
            f'Field "{field}" must be an integer',
            [{"field": field, "message": "Expected integer"}],
        )
    return int(value)


def _require_string(input_data: dict[str, Any], field: str) -> str:
    value = input_data.get(field)
    if not isinstance(value, str) or len(value) == 0:
        raise ValidationError(
            f'Field "{field}" must be a non-empty string',
            [{"field": field, "message": "Expected non-empty string"}],
        )
    return value


def _optional_string(input_data: dict[str, Any], field: str) -> str | None:
    if field not in input_data:
        return None
    return _require_string(input_data, field)


def _optional_bool(input_data: dict[str, Any], field: str) -> bool | None:
    if field not in input_data:
        return None
    value = input_data[field]
    if not isinstance(value, bool):
        raise ValidationError(
            f'Field "{field}" must be a boolean',
            [{"field": field, "message": "Expected boolean"}],
        )
    return value
