"""VAT Module — Pure-function VAT calculation engine for Nigerian VAT per NTA 2025."""

from __future__ import annotations

from .errors import InvalidAmountError, InvalidCategoryError
from .rates import get
from .types import TaxCategory, VatResult
from .utils import bankers_round

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


def _classify_category(category: str) -> str:
    """Determine the rate type for a given category."""
    if category in ZERO_RATED_CATEGORIES:
        return "zero-rated"
    if category in EXEMPT_CATEGORIES:
        return "exempt"
    return "standard"


def _get_legal_basis(category: str) -> str:
    """Resolve the legal basis string for a category from the rate data."""
    if category == "standard":
        return get("vat.standard.legalBasis")  # type: ignore[return-value]
    if category in ZERO_RATED_CATEGORIES:
        return get(f"vat.zeroRated.{category}.legalBasis")  # type: ignore[return-value]
    return get(f"vat.exempt.{category}.legalBasis")  # type: ignore[return-value]


def _validate_inputs(amount: float, category: str) -> None:
    if amount < 0:
        raise InvalidAmountError(f"Amount must be non-negative, received {amount}")
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
        year = int(date[:4])
        if year < 2026:
            return 0.075

    return get("vat.standard.rate")  # type: ignore[return-value]


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
        rate_type=rate_type,  # type: ignore[arg-type]
        category=category,  # type: ignore[arg-type]
        legal_basis=legal_basis,
        input_vat_recoverable=input_vat_recoverable,
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
