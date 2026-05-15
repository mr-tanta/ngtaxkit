"""Pension Module — Pure-function pension contribution calculator per PRA 2014."""

from __future__ import annotations

import datetime
import math

from .errors import InvalidPensionRateError
from .rates import get_float, get_int, get_str
from .types import PensionResult
from .utils import add_working_days, assert_non_negative_finite, bankers_round

# ─── Rate Data ────────────────────────────────────────────────────────────────

MIN_EMPLOYEE_RATE = get_float("pension.minimumRates.employee")
MIN_EMPLOYER_RATE = get_float("pension.minimumRates.employer")
DEADLINE_WORKING_DAYS = get_int("pension.remittance.deadlineWorkingDays")
LEGAL_BASIS = get_str("pension.legalBasis")
REMITTANCE_METHOD = "PFA transfer"

# ─── Public API ───────────────────────────────────────────────────────────────


def calculate(
    basic_salary: float,
    housing_allowance: float = 0.0,
    transport_allowance: float = 0.0,
    employee_rate: float | None = None,
    employer_rate: float | None = None,
    salary_payment_date: str | None = None,
) -> PensionResult:
    """Calculate pension contributions under the Contributory Pension Scheme (CPS).

    Pensionable earnings = basic_salary + housing_allowance + transport_allowance.
    Employee contributes at least 8%, employer at least 10%.
    """
    eff_employee_rate = employee_rate if employee_rate is not None else MIN_EMPLOYEE_RATE
    eff_employer_rate = employer_rate if employer_rate is not None else MIN_EMPLOYER_RATE

    assert_non_negative_finite("basic_salary", basic_salary)
    assert_non_negative_finite("housing_allowance", housing_allowance)
    assert_non_negative_finite("transport_allowance", transport_allowance)

    # Validate minimum rates
    if (
        not isinstance(eff_employee_rate, (int, float))
        or not math.isfinite(eff_employee_rate)
        or eff_employee_rate < MIN_EMPLOYEE_RATE
    ):
        raise InvalidPensionRateError(
            f"Employee pension rate {eff_employee_rate} is below the legal minimum of "
            f"{MIN_EMPLOYEE_RATE} ({MIN_EMPLOYEE_RATE * 100}%)",
            "PRA 2014, Section 4(1)",
        )

    if (
        not isinstance(eff_employer_rate, (int, float))
        or not math.isfinite(eff_employer_rate)
        or eff_employer_rate < MIN_EMPLOYER_RATE
    ):
        raise InvalidPensionRateError(
            f"Employer pension rate {eff_employer_rate} is below the legal minimum of "
            f"{MIN_EMPLOYER_RATE} ({MIN_EMPLOYER_RATE * 100}%)",
            "PRA 2014, Section 4(1)",
        )

    # Calculate contributions
    pensionable_earnings = basic_salary + housing_allowance + transport_allowance
    employee_contribution = bankers_round(pensionable_earnings * eff_employee_rate)
    employer_contribution = bankers_round(pensionable_earnings * eff_employer_rate)
    total_contribution = bankers_round(employee_contribution + employer_contribution)

    # Remittance deadline
    effective_date = salary_payment_date or datetime.date.today().isoformat()
    remittance_deadline = add_working_days(effective_date, DEADLINE_WORKING_DAYS)

    return PensionResult(
        pensionable_earnings=pensionable_earnings,
        employee_contribution=employee_contribution,
        employer_contribution=employer_contribution,
        total_contribution=total_contribution,
        remittance_deadline=remittance_deadline,
        remittance_method=REMITTANCE_METHOD,
        legal_basis=LEGAL_BASIS,
    )
