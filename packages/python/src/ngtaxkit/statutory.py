"""Statutory Deductions Module — NHF, NSITF, and ITF calculators."""

from __future__ import annotations

from typing import Literal

from .rates import get_float, get_int, get_str
from .types import AllStatutoryResult, ItfResult, NhfResult, NsitfResult
from .utils import assert_non_negative_finite, bankers_round

# ─── Rate Data ────────────────────────────────────────────────────────────────

NHF_RATE = get_float("statutory.nhf.rate")
NHF_LEGAL_BASIS = get_str("statutory.nhf.legalBasis")

NSITF_RATE = get_float("statutory.nsitf.rate")
NSITF_LEGAL_BASIS = get_str("statutory.nsitf.legalBasis")
NSITF_CONTRIBUTOR_TYPE = get_str("statutory.nsitf.contributorType")

ITF_RATE = get_float("statutory.itf.rate")
ITF_LEGAL_BASIS = get_str("statutory.itf.legalBasis")
ITF_MIN_EMPLOYEES = get_int("statutory.itf.thresholds.minimumEmployees")
ITF_MIN_TURNOVER = get_float("statutory.itf.thresholds.minimumAnnualTurnover")
ITF_REFUND_MAX_RATE = get_float("statutory.itf.refund.maxRate")

# ─── Public API ───────────────────────────────────────────────────────────────


def nhf(basic_salary: float) -> NhfResult:
    """Calculate National Housing Fund (NHF) contribution.

    NHF = 2.5% of basic salary (employee contribution).
    """
    assert_non_negative_finite("basic_salary", basic_salary)
    return NhfResult(
        nhf_amount=bankers_round(basic_salary * NHF_RATE),
        rate=NHF_RATE,
        base="basicSalary",
        legal_basis=NHF_LEGAL_BASIS,
    )


def nsitf(monthly_payroll: float) -> NsitfResult:
    """Calculate Nigeria Social Insurance Trust Fund (NSITF) contribution.

    NSITF = 1% of monthly payroll (employer-only contribution).
    """
    assert_non_negative_finite("monthly_payroll", monthly_payroll)
    return NsitfResult(
        nsitf_amount=bankers_round(monthly_payroll * NSITF_RATE),
        rate=NSITF_RATE,
        base="monthlyPayroll",
        contributor_type=NSITF_CONTRIBUTOR_TYPE,
        legal_basis=NSITF_LEGAL_BASIS,
    )


def itf(
    annual_payroll: float,
    employee_count: int,
    annual_turnover: float = 0.0,
    training_spend: float = 0.0,
) -> ItfResult:
    """Calculate Industrial Training Fund (ITF) contribution.

    ITF = 1% of annual payroll for organisations with 5+ employees OR ₦50M+ annual turnover.
    Refund = min(itf_amount × 50%, training_spend).
    """
    assert_non_negative_finite("annual_payroll", annual_payroll)
    assert_non_negative_finite("employee_count", employee_count)
    assert_non_negative_finite("annual_turnover", annual_turnover)
    assert_non_negative_finite("training_spend", training_spend)

    eligible_by_employees = employee_count >= ITF_MIN_EMPLOYEES
    eligible_by_turnover = annual_turnover >= ITF_MIN_TURNOVER
    eligible = eligible_by_employees or eligible_by_turnover

    if not eligible:
        return ItfResult(
            itf_amount=0.0,
            rate=ITF_RATE,
            eligible=False,
            eligibility_basis=None,
            refund_amount=0.0,
            legal_basis=ITF_LEGAL_BASIS,
        )

    eligibility_basis: Literal["employeeCount", "annualTurnover"] = (
        "employeeCount" if eligible_by_employees else "annualTurnover"
    )
    itf_amount = bankers_round(annual_payroll * ITF_RATE)
    max_refund = bankers_round(itf_amount * ITF_REFUND_MAX_RATE)
    refund_amount = min(max_refund, training_spend)

    return ItfResult(
        itf_amount=itf_amount,
        rate=ITF_RATE,
        eligible=True,
        eligibility_basis=eligibility_basis,
        refund_amount=refund_amount,
        legal_basis=ITF_LEGAL_BASIS,
    )


def calculate_all(
    basic_salary: float,
    monthly_payroll: float,
    annual_payroll: float,
    employee_count: int,
    annual_turnover: float = 0.0,
    training_spend: float = 0.0,
) -> AllStatutoryResult:
    """Calculate all statutory deductions (NHF + NSITF + ITF) in a single call."""
    return AllStatutoryResult(
        nhf=nhf(basic_salary),
        nsitf=nsitf(monthly_payroll),
        itf=itf(
            annual_payroll=annual_payroll,
            employee_count=employee_count,
            annual_turnover=annual_turnover,
            training_spend=training_spend,
        ),
    )
