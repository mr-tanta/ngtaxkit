"""WHT Module — Pure-function Withholding Tax calculation engine per WHT Regulations 2024."""

from __future__ import annotations

import datetime

from .errors import InvalidServiceTypeError, ValidationError
from .explain import collect_rate_sources, unique_rate_keys
from .rates import get_float, get_int, get_str
from .types import CalculationExplanation, WhtResult
from .utils import assert_non_negative_finite, bankers_round

# ─── Internal Helpers ─────────────────────────────────────────────────────────

ALL_SERVICE_TYPES: list[str] = [
    "professional",
    "management",
    "technical",
    "consultancy",
    "commission",
    "construction",
    "contract",
    "rent",
    "royalty",
    "dividend",
    "interest",
]

SMALL_COMPANY_THRESHOLD = get_float("wht.smallCompanyExemption.threshold")
SMALL_COMPANY_LEGAL_BASIS = get_str("wht.smallCompanyExemption.legalBasis")
REMITTANCE_DAY = get_int("wht.remittanceDeadline.dayOfMonth")


def _validate_service_type(service_type: str) -> None:
    if service_type not in ALL_SERVICE_TYPES:
        raise InvalidServiceTypeError(
            f'Unknown WHT service type "{service_type}"',
            ALL_SERVICE_TYPES,
        )


def _validate_payee_type(payee_type: str) -> None:
    if payee_type not in ("individual", "company"):
        raise ValidationError(
            f'Unknown WHT payee type "{payee_type}"',
            [{"field": "payee_type", "message": 'Must be "individual" or "company"'}],
        )


def _calc_remittance_deadline(payment_date: str, day_of_month: int) -> str:
    """Calculate remittance deadline as the Nth day of the month following the payment date."""
    year, month, _ = (int(x) for x in payment_date.split("-"))
    next_month = month + 1
    next_year = year
    if next_month > 12:
        next_month = 1
        next_year += 1

    import calendar
    last_day = calendar.monthrange(next_year, next_month)[1]
    clamped_day = min(day_of_month, last_day)
    return f"{next_year}-{next_month:02d}-{clamped_day:02d}"


# ─── Public API ───────────────────────────────────────────────────────────────


def calculate(
    amount: float,
    payee_type: str,
    service_type: str,
    payee_is_small_company: bool = False,
    payee_tin: str | None = None,
    payment_date: str | None = None,
) -> WhtResult:
    """Calculate WHT on a payment."""
    assert_non_negative_finite("amount", amount)
    _validate_payee_type(payee_type)
    _validate_service_type(service_type)

    rate = get_rate(service_type, payee_type)
    legal_basis = get_str(f"wht.serviceTypes.{service_type}.legalBasis")

    # Determine payment date for remittance deadline
    effective_date = payment_date or datetime.date.today().isoformat()
    remittance_deadline = _calc_remittance_deadline(effective_date, REMITTANCE_DAY)

    # Small company exemption
    if payee_is_small_company and amount <= SMALL_COMPANY_THRESHOLD:
        return WhtResult(
            gross_amount=amount,
            rate=rate,
            wht_amount=0.0,
            net_payment=amount,
            exempt=True,
            exemption_basis=SMALL_COMPANY_LEGAL_BASIS,
            remittance_deadline=remittance_deadline,
            credit_note_required=False,
            legal_basis=legal_basis,
        )

    wht_amount = bankers_round(amount * rate)
    net_payment = bankers_round(amount - wht_amount)

    return WhtResult(
        gross_amount=amount,
        rate=rate,
        wht_amount=wht_amount,
        net_payment=net_payment,
        exempt=False,
        exemption_basis=None,
        remittance_deadline=remittance_deadline,
        credit_note_required=wht_amount > 0,
        legal_basis=legal_basis,
    )


def explain_calculate(
    amount: float,
    payee_type: str,
    service_type: str,
    payee_is_small_company: bool = False,
    payee_tin: str | None = None,
    payment_date: str | None = None,
) -> CalculationExplanation:
    """Calculate WHT and return the source-backed reasoning used for the result."""
    effective_payment_date = payment_date or datetime.date.today().isoformat()
    result = calculate(
        amount=amount,
        payee_type=payee_type,
        service_type=service_type,
        payee_is_small_company=payee_is_small_company,
        payee_tin=payee_tin,
        payment_date=effective_payment_date,
    )

    rate_keys = [
        f"wht.serviceTypes.{service_type}.{payee_type}",
        "wht.remittanceDeadline.dayOfMonth",
    ]
    if payee_is_small_company:
        rate_keys.append("wht.smallCompanyExemption.threshold")
    rate_keys = unique_rate_keys(rate_keys)
    sources, warnings = collect_rate_sources(rate_keys)

    if result["exempt"]:
        formula = [
            f"Gross amount = {amount}.",
            "Small company exemption applies because the payee is marked as a small company and the gross amount is at or below the exemption threshold.",
            "WHT amount = 0.",
            "Net payment = gross amount.",
        ]
    else:
        formula = [
            f"Gross amount = {amount}.",
            "WHT amount = gross amount * withholding rate.",
            "Net payment = gross amount - WHT amount.",
            "Remittance deadline = configured day of the month following the payment date.",
        ]

    assumptions = [
        "Amounts are denominated in Nigerian naira.",
        "Monetary values use banker's rounding to 2 decimal places.",
        f"Payment date {effective_payment_date} is used for the remittance deadline.",
    ]
    if not payee_tin:
        assumptions.append(
            "No payee TIN was supplied; the bundled WHT calculator currently does not alter rates by TIN availability."
        )

    return CalculationExplanation(
        inputs={
            "amount": amount,
            "payee_type": payee_type,
            "service_type": service_type,
            "payee_is_small_company": payee_is_small_company,
            "payee_tin": payee_tin,
            "payment_date": effective_payment_date,
        },
        result=result,
        formula=formula,
        assumptions=assumptions,
        rate_keys=rate_keys,
        sources=sources,
        warnings=warnings,
    )


def get_rate(service_type: str, payee_type: str) -> float:
    """Get the WHT rate for a service type and payee type."""
    _validate_service_type(service_type)
    _validate_payee_type(payee_type)
    return get_float(f"wht.serviceTypes.{service_type}.{payee_type}")


def list_service_types() -> list[str]:
    """List all recognised WHT service types."""
    return list(ALL_SERVICE_TYPES)
