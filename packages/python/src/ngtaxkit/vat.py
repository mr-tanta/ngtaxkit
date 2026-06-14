"""VAT Module — Pure-function VAT calculation engine for Nigerian VAT per NTA 2025."""

from __future__ import annotations

from typing import cast

from .errors import InvalidCategoryError
from .explain import collect_rate_sources
from .rates import get_float, get_str
from .types import CalculationExplanation, RateType, TaxCategory, VatResult
from .utils import assert_non_negative_finite, bankers_round, parse_iso_date

# ─── Internal Helpers ─────────────────────────────────────────────────────────

ZERO_RATED_CATEGORIES: frozenset[str] = frozenset([
    "basic-food",
    "medicine",
    "medical-equipment",
    "medical-services",
    "educational-books",
    "tuition",
    "electricity",
    "export-services",
    "humanitarian-goods",
])

EXEMPT_CATEGORIES: frozenset[str] = frozenset([
    "residential-rent",
    "public-transport",
    "financial-services",
    "insurance",
])

ALL_CATEGORIES: list[str] = [
    "standard",
    *sorted(ZERO_RATED_CATEGORIES),
    *sorted(EXEMPT_CATEGORIES),
]


def _classify_category(category: str) -> RateType:
    """Determine the rate type for a given category."""
    if category in ZERO_RATED_CATEGORIES:
        return "zero-rated"
    if category in EXEMPT_CATEGORIES:
        return "exempt"
    return "standard"


def _get_legal_basis(category: str) -> str:
    """Resolve the legal basis string for a category from the rate data."""
    if category == "standard":
        return get_str("vat.standard.legalBasis")
    if category in ZERO_RATED_CATEGORIES:
        return get_str(f"vat.zeroRated.{category}.legalBasis")
    return get_str(f"vat.exempt.{category}.legalBasis")


def _get_rate_key(category: str) -> str:
    if category == "standard":
        return "vat.standard.rate"
    if category in ZERO_RATED_CATEGORIES:
        return f"vat.zeroRated.{category}.rate"
    return f"vat.exempt.{category}.rate"


def _validate_inputs(amount: float, category: str) -> None:
    assert_non_negative_finite("amount", amount)
    if category not in ALL_CATEGORIES:
        raise InvalidCategoryError(
            f'Unknown VAT category "{category}"',
            ALL_CATEGORIES,
        )


def _resolve_rate(category: str, date: str | None = None) -> float:
    """Resolve the numeric VAT rate for a category."""
    rate_type = _classify_category(category)
    if rate_type in ("zero-rated", "exempt"):
        return 0.0

    if date:
        year = parse_iso_date(date, "date").year
        if year < 2026:
            return 0.075

    return get_float("vat.standard.rate")


# ─── Public API ───────────────────────────────────────────────────────────────


def calculate(
    amount: float,
    inclusive: bool = False,
    category: str = "standard",
    date: str | None = None,
) -> VatResult:
    """Calculate VAT on an amount.

    - Exclusive (default): net = amount, vat = net × rate, gross = net + vat
    - Inclusive: gross = amount, net = gross / (1 + rate), vat = gross − net
    """
    _validate_inputs(amount, category)
    typed_category = cast(TaxCategory, category)

    rate_type = _classify_category(category)
    rate = _resolve_rate(category, date)
    legal_basis = _get_legal_basis(category)
    input_vat_recoverable = rate_type != "exempt"

    if rate_type in ("zero-rated", "exempt"):
        net = bankers_round(amount)
        vat = 0.0
        gross = net
    elif inclusive:
        gross = bankers_round(amount)
        net = bankers_round(amount / (1 + rate))
        vat = bankers_round(gross - net)
    else:
        net = bankers_round(amount)
        vat = bankers_round(net * rate)
        gross = bankers_round(net + vat)

    return VatResult(
        net=net,
        vat=vat,
        gross=gross,
        rate=rate,
        rate_type=rate_type,
        category=typed_category,
        legal_basis=legal_basis,
        input_vat_recoverable=input_vat_recoverable,
    )


def explain_calculate(
    amount: float,
    inclusive: bool = False,
    category: str = "standard",
    date: str | None = None,
) -> CalculationExplanation:
    """Calculate VAT and return the source-backed reasoning used for the result."""
    result = calculate(amount=amount, inclusive=inclusive, category=category, date=date)
    rate_keys = [_get_rate_key(category)]
    sources, warnings = collect_rate_sources(rate_keys)

    if result["rate_type"] == "standard":
        formula = (
            [
                "Gross amount is VAT-inclusive.",
                "Net amount = gross amount / (1 + rate).",
                "VAT = gross amount - net amount.",
            ]
            if inclusive
            else [
                "Net amount is VAT-exclusive.",
                "VAT = net amount * rate.",
                "Gross amount = net amount + VAT.",
            ]
        )
    else:
        formula = [
            f'VAT = 0 because category "{category}" is {result["rate_type"]}.',
            "Gross amount equals net amount.",
        ]

    assumptions = [
        "Amounts are denominated in Nigerian naira.",
        "Monetary values use banker's rounding to 2 decimal places.",
    ]
    if result["rate_type"] == "zero-rated":
        assumptions.append(
            "The category is zero-rated, so output VAT is 0 and input VAT recoverable remains true."
        )
    if result["rate_type"] == "exempt":
        assumptions.append(
            "The category is exempt, so output VAT is 0 and input VAT recoverable is false."
        )
    if date:
        assumptions.append(f"The requested date {date} is used for rate-regime selection.")

    return CalculationExplanation(
        inputs={
            "amount": amount,
            "inclusive": inclusive,
            "category": category,
            "date": date,
        },
        result=result,
        formula=formula,
        assumptions=assumptions,
        rate_keys=rate_keys,
        sources=sources,
        warnings=warnings,
    )


def extract(
    amount: float,
    category: str = "standard",
    date: str | None = None,
) -> VatResult:
    """Extract VAT from a VAT-inclusive amount. Alias for calculate with inclusive=True."""
    return calculate(amount, inclusive=True, category=category, date=date)


def is_taxable(category: str) -> bool:
    """Returns True if the category is subject to VAT (standard rate > 0)."""
    return _classify_category(category) == "standard"


def is_zero_rated(category: str) -> bool:
    """Returns True if the category is zero-rated (0% VAT, input VAT recoverable)."""
    return _classify_category(category) == "zero-rated"


def is_exempt(category: str) -> bool:
    """Returns True if the category is VAT-exempt (0% VAT, input VAT NOT recoverable)."""
    return _classify_category(category) == "exempt"


def get_rate(category: str, date: str | None = None) -> float:
    """Get the VAT rate for a category, optionally for a specific date."""
    return _resolve_rate(category, date)


def list_categories() -> list[str]:
    """List all recognised VAT categories."""
    return list(ALL_CATEGORIES)
