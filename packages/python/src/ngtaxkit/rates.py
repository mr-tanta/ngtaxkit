"""Rates Registry — versioned store of all Nigerian tax rates, brackets, and thresholds.

Loads bundled JSON rate files at module initialization. Zero dependencies.
"""

from __future__ import annotations

import json
import math
from datetime import date
from importlib.resources import files
from pathlib import Path
from typing import Any

from .errors import RateNotFoundError
from .types import RateAuditResult, RateSourceMetadata

# ─── Types ────────────────────────────────────────────────────────────────────

RateValue = Any  # number | str | bool | None | list | dict
JsonObject = dict[str, Any]
_MISSING = object()

# ─── Internal State ───────────────────────────────────────────────────────────

_REPO_RATES_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "shared" / "rates"


def _require_json_object(value: Any, filename: str) -> JsonObject:
    if not isinstance(value, dict):
        raise RateNotFoundError(f'Rate file "{filename}" must contain a JSON object')
    return value


def _load_json(filename: str) -> JsonObject:
    package_path = files("ngtaxkit").joinpath("data", "rates", filename)
    if package_path.is_file():
        return _require_json_object(json.loads(package_path.read_text(encoding="utf-8")), filename)

    # Editable installs from a repo checkout can still use the shared source data.
    with open(_REPO_RATES_DIR / filename, "r", encoding="utf-8") as f:
        return _require_json_object(json.load(f), filename)


_registry: dict[str, dict[str, Any]] = {
    "vat": _load_json("vat_rates_2026.json"),
    "paye": _load_json("paye_brackets_2026.json"),
    "wht": _load_json("wht_rates_2026.json"),
    "pension": _load_json("pension_rates_2026.json"),
    "statutory": _load_json("statutory_2026.json"),
    "state_filing": _load_json("state_filing_2026.json"),
}

_source_registry = _load_json("source_metadata_2026.json")

_custom_overrides: dict[str, RateValue] = {}
_custom_source_overrides: dict[str, JsonObject] = {}

# ─── Internal Helpers ─────────────────────────────────────────────────────────


def _read_bundled_rate_value(key: str) -> Any:
    segments = key.split(".")
    domain = segments[0]
    rest = segments[1:]

    current: Any = _registry.get(domain, _MISSING)
    if current is _MISSING:
        return _MISSING

    for segment in rest:
        if current is None or not isinstance(current, dict):
            return _MISSING
        if segment not in current:
            return _MISSING
        current = current[segment]

    return current


def _flatten_rate_value(prefix: str, value: Any) -> list[str]:
    if value is None or not isinstance(value, dict):
        return [prefix]

    keys: list[str] = []
    for child_key, child_value in value.items():
        keys.extend(_flatten_rate_value(f"{prefix}.{child_key}", child_value))
    return keys


def _flatten_registry_keys() -> list[str]:
    keys: list[str] = []
    for domain, data in _registry.items():
        keys.extend(_flatten_rate_value(domain, data))
    return keys


def _source_metadata() -> dict[str, JsonObject]:
    metadata = _source_registry.get("metadata")
    if not isinstance(metadata, dict):
        raise RateNotFoundError('Rate source metadata file must contain a "metadata" object')
    return metadata


def _find_source_metadata_key(key: str) -> str | None:
    metadata = _source_metadata()
    segments = key.split(".")

    for index in range(len(segments), 0, -1):
        candidate = ".".join(segments[:index])
        if candidate in metadata:
            return candidate

    return None


def _source_for_key(key: str) -> tuple[str, JsonObject] | None:
    metadata_key = _find_source_metadata_key(key)
    if metadata_key is None:
        return None
    return metadata_key, _source_metadata()[metadata_key]


def _source_field(source: JsonObject, camel_key: str, snake_key: str) -> Any:
    if camel_key in source:
        return source[camel_key]
    return source[snake_key]


def _default_custom_override_source() -> JsonObject:
    return {
        "source_title": "Process-local custom override",
        "source_url": "",
        "source_type": "secondary_reference",
        "legal_basis": "Custom override set via rates.set_custom(); no legal source metadata supplied.",
        "effective_date": get_effective_date(),
        "last_reviewed": date.today().isoformat(),
        "verification_status": "needs_review",
        "confidence": "low",
        "notes": "This value was supplied by the current process and is not part of the bundled source-backed rate registry.",
    }


def _build_source_metadata(
    key: str,
    value: Any,
    metadata_key: str,
    source: JsonObject,
    overridden: bool,
    warnings: list[str] | None = None,
) -> RateSourceMetadata:
    return {
        "key": key,
        "value": value,
        "metadata_key": metadata_key,
        "overridden": overridden,
        "warnings": warnings or [],
        "source_title": str(_source_field(source, "sourceTitle", "source_title")),
        "source_url": str(_source_field(source, "sourceUrl", "source_url")),
        "source_type": _source_field(source, "sourceType", "source_type"),
        "legal_basis": str(_source_field(source, "legalBasis", "legal_basis")),
        "effective_date": str(_source_field(source, "effectiveDate", "effective_date")),
        "last_reviewed": str(_source_field(source, "lastReviewed", "last_reviewed")),
        "verification_status": _source_field(source, "verificationStatus", "verification_status"),
        "confidence": source["confidence"],
        "notes": str(source["notes"]),
    }

# ─── Public API ───────────────────────────────────────────────────────────────


def get(key: str) -> RateValue:
    """Look up a rate value by dot-separated key path.

    Examples:
        get("vat.standard.rate")       → 0.075
        get("paye.exemptionThreshold") → 800000
        get("wht.serviceTypes.professional.individual") → 0.05

    Custom overrides (set via set_custom) take precedence over bundled data.

    Raises:
        RateNotFoundError: if the key path does not resolve to a value.
    """
    # Check custom overrides first
    if key in _custom_overrides:
        return _custom_overrides[key]

    segments = key.split(".")
    if len(segments) < 2:
        raise RateNotFoundError(
            f'Rate key "{key}" is invalid — must contain at least a domain prefix and a property (e.g., "vat.standard")'
        )

    domain = segments[0]
    rest = segments[1:]

    data = _registry.get(domain)
    if data is None:
        raise RateNotFoundError(
            f'Rate domain "{domain}" not found — valid domains: {", ".join(_registry.keys())}'
        )

    current: Any = data
    for segment in rest:
        if current is None or not isinstance(current, dict):
            raise RateNotFoundError(
                f'Rate key "{key}" not found — path segment "{segment}" is not navigable'
            )
        if segment not in current:
            raise RateNotFoundError(f'Rate key "{key}" not found')
        current = current[segment]

    if current is None and segment not in (data if len(rest) == 1 else {}):
        # Allow explicit None values (like portalUrl: null)
        pass

    return current


def get_float(key: str) -> float:
    """Look up a numeric rate value."""
    value = get(key)
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(float(value))
    ):
        raise RateNotFoundError(f'Rate key "{key}" must resolve to a finite number')
    return float(value)


def get_int(key: str) -> int:
    """Look up an integer rate value."""
    value = get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise RateNotFoundError(f'Rate key "{key}" must resolve to an integer')
    return value


def get_str(key: str) -> str:
    """Look up a string rate value."""
    value = get(key)
    if not isinstance(value, str):
        raise RateNotFoundError(f'Rate key "{key}" must resolve to a string')
    return value


def get_dict(key: str) -> JsonObject:
    """Look up an object rate value."""
    value = get(key)
    if not isinstance(value, dict):
        raise RateNotFoundError(f'Rate key "{key}" must resolve to an object')
    return value


def get_list(key: str) -> list[Any]:
    """Look up an array rate value."""
    value = get(key)
    if not isinstance(value, list):
        raise RateNotFoundError(f'Rate key "{key}" must resolve to an array')
    return value


def get_version() -> str:
    """Returns the version identifier of the currently loaded rates."""
    return get_str("vat.version")


def get_effective_date() -> str:
    """Returns the effective date of the currently loaded rates (ISO 8601)."""
    return get_str("vat.effectiveDate")


def explain(key: str) -> RateSourceMetadata:
    """Explain a bundled rate with source metadata.

    Exact metadata is preferred. If a rate is covered by a source-backed prefix,
    the returned key and value stay scoped to the requested rate while the source
    record comes from that prefix.

    Raises:
        RateNotFoundError: if the key path does not resolve to a value.
    """
    value = get(key)

    if key in _custom_overrides:
        custom_source = _custom_source_overrides.get(key)
        warnings = [] if custom_source else [
            f"{key}: custom override has no custom source metadata; verify before using in filings or user-facing advice."
        ]
        return _build_source_metadata(
            key,
            value,
            key,
            custom_source or _default_custom_override_source(),
            True,
            warnings,
        )

    source_match = _source_for_key(key)
    if source_match is None:
        raise RateNotFoundError(f'Rate source metadata for "{key}" not found')
    metadata_key, source = source_match
    return _build_source_metadata(key, value, metadata_key, source, False)


def audit() -> RateAuditResult:
    """Audit source metadata coverage for all bundled rate leaf keys."""
    rate_keys = _flatten_registry_keys()
    coverage_sources = [_source_for_key(key) for key in rate_keys]
    missing_metadata = [
        key for key, source in zip(rate_keys, coverage_sources, strict=True) if source is None
    ]
    metadata = _source_metadata()
    orphaned_metadata = [
        key for key in metadata if _read_bundled_rate_value(key) is _MISSING
    ]
    sources = [
        _build_source_metadata(
            key,
            None if (value := _read_bundled_rate_value(key)) is _MISSING else value,
            key,
            source,
            False,
        )
        for key, source in metadata.items()
    ]

    return {
        "version": str(_source_registry["version"]),
        "effective_date": str(_source_registry["effectiveDate"]),
        "last_reviewed": str(_source_registry["lastReviewed"]),
        "total_keys": len(rate_keys),
        "verified": sum(
            1 for source in coverage_sources if source and source[1]["verificationStatus"] == "verified"
        ),
        "needs_review": sum(
            1 for source in coverage_sources if source and source[1]["verificationStatus"] == "needs_review"
        ),
        "disputed": sum(
            1 for source in coverage_sources if source and source[1]["verificationStatus"] == "disputed"
        ),
        "missing_metadata": missing_metadata,
        "orphaned_metadata": orphaned_metadata,
        "sources": sources,
    }


def set_custom(overrides: dict[str, RateValue]) -> None:
    """Override specific rates for the current process lifetime.

    Overrides are keyed by the same dot-separated path used in get().
    Does not persist across process restarts.
    """
    _custom_overrides.update(overrides)


def set_custom_sources(sources: dict[str, JsonObject]) -> None:
    """Attach source metadata to process-lifetime custom overrides."""
    _custom_source_overrides.update(sources)


def clear_custom() -> None:
    """Clear all custom overrides, reverting to bundled rates."""
    _custom_overrides.clear()
    _custom_source_overrides.clear()


async def refresh() -> None:
    """Reserved hook for future external rate refresh integrations.

    The offline package uses bundled rates, so this is currently a no-op.
    """
    pass
