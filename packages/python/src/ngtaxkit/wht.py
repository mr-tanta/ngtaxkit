"""WHT Module — Pure-function Withholding Tax calculation engine per WHT Regulations 2024."""

from __future__ import annotations

import datetime

from .errors import InvalidServiceTypeError
from .rates import get
from .types import WhtResult, WhtServiceType
from .utils import bankers_round

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

SMALL_COMPANY_THRESHOLD: float = get("wht.smallCompanyExemption.threshold")  # type: ignore[assignment]
SMALL_COMPANY_LEGAL_BASIS: str = get("wht.smallCompanyExemption.legalBasis")  # type: ignore[assignment]
REMITTANCE_DAY: int = get("wht.remittanceDeadline.dayOfMonth")  # type: ignore[assignment]


def _validate_service_type(service_type: str) -> None:
    if service_type not in ALL_SERVICE_TYPES:
        raise InvalidServiceTypeError(
            f'Unknown WHT service type "{service_type}"',
            ALL_SERVICE_TYPES,
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
    _validate_service_type(service_type)

    rate = get_rate(service_type, payee_type)
    legal_basis: str = get(f"wht.serviceTypes.{service_type}.legalBasis")  # type: ignore[assignment]

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


def get_rate(service_type: str, payee_type: str) -> float:
    """Get the WHT rate for a service type and payee type."""
    _validate_service_type(service_type)
    return get(f"wht.serviceTypes.{service_type}.{payee_type}")  # type: ignore[return-value]


def list_service_types() -> list[str]:
    """List all recognised WHT service types."""
    return list(ALL_SERVICE_TYPES)
