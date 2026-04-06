"""Rates Registry — versioned store of all Nigerian tax rates, brackets, and thresholds.

Loads bundled JSON rate files at module initialization. Zero dependencies.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .errors import RateNotFoundError

# ─── Types ────────────────────────────────────────────────────────────────────

RateValue = Any  # number | str | bool | None | list | dict

# ─── Internal State ───────────────────────────────────────────────────────────

_RATES_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "shared" / "rates"


def _load_json(filename: str) -> dict[str, Any]:
    with open(_RATES_DIR / filename, "r", encoding="utf-8") as f:
        return json.load(f)


_registry: dict[str, dict[str, Any]] = {
    "vat": _load_json("vat_rates_2026.json"),
    "paye": _load_json("paye_brackets_2026.json"),
    "wht": _load_json("wht_rates_2026.json"),
    "pension": _load_json("pension_rates_2026.json"),
    "statutory": _load_json("statutory_2026.json"),
    "state_filing": _load_json("state_filing_2026.json"),
}

_custom_overrides: dict[str, RateValue] = {}

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


def get_version() -> str:
    """Returns the version identifier of the currently loaded rates."""
    return _registry["vat"]["version"]


def get_effective_date() -> str:
    """Returns the effective date of the currently loaded rates (ISO 8601)."""
    return _registry["vat"]["effectiveDate"]


def set_custom(overrides: dict[str, RateValue]) -> None:
    """Override specific rates for the current process lifetime.

    Overrides are keyed by the same dot-separated path used in get().
    Does not persist across process restarts.
    """
    _custom_overrides.update(overrides)


def clear_custom() -> None:
    """Clear all custom overrides, reverting to bundled rates."""
    _custom_overrides.clear()


async def refresh() -> None:
    """Refresh rates from the Cloud API.

    Stub in the offline-first Layer 1 package — actual implementation
    lives in the Cloud API client (Layer 3).
    """
    pass
