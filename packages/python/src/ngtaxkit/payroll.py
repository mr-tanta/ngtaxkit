"""Payroll Module — Batch payroll calculator with multi-state PAYE aggregation per NTA 2025."""

from __future__ import annotations

import datetime
from typing import Any

from . import paye as paye_module
from .errors import InvalidStateError
from .rates import get
from .types import (
    NigerianState,
    PayeResult,
    PayrollBatchResult,
    PayrollEmployeeResult,
    PayrollTotals,
    StatePayrollSummary,
)
from .utils import bankers_round, get_remittance_deadline


def _get_valid_state_codes() -> list[str]:
    """Get all valid state codes from the rates registry."""
    jurisdictions = get("state_filing.jurisdictions")
    return list(jurisdictions.keys())  # type: ignore[union-attr]


def _validate_state_code(state_code: str, valid_states: list[str]) -> None:
    """Validate that a state code exists in the rates registry."""
    if state_code not in valid_states:
        raise InvalidStateError(
            f'Invalid state code "{state_code}" — must be one of the 37 Nigerian state codes',
            valid_states,
        )


def _get_form_h1_deadline(tax_year: int) -> str:
    """Build the Form H1 deadline: January 31 of the year following the current tax year."""
    return f"{tax_year + 1}-01-31"


def calculate_batch(
    employees: list[dict[str, Any]],
) -> PayrollBatchResult:
    """Calculate PAYE for a batch of employees, grouped by state of residence."""
    # ── Empty batch ──
    if not employees:
        return PayrollBatchResult(
            employees=[],
            by_state={},
            totals=PayrollTotals(
                total_gross=0.0,
                total_paye=0.0,
                total_pension=0.0,
                total_nhf=0.0,
                employee_count=0,
            ),
        )

    valid_states = _get_valid_state_codes()
    current_year = datetime.date.today().year

    # ── Validate all state codes upfront ──
    for emp in employees:
        _validate_state_code(emp["state_of_residence"], valid_states)

    # ── Calculate individual PAYE for each employee ──
    employee_results: list[PayrollEmployeeResult] = []
    state_groups: dict[str, dict[str, Any]] = {}

    for emp in employees:
        paye_result = paye_module.calculate(
            gross_annual=emp["gross_annual"],
            pension_contributing=emp.get("pension_contributing", False),
            nhf_contributing=emp.get("nhf_contributing", False),
            rent_paid_annual=emp.get("rent_paid_annual", 0.0),
        )

        enriched = PayrollEmployeeResult(
            **paye_result,
            id=emp.get("id"),
            name=emp["name"],
            state_of_residence=emp["state_of_residence"],
        )
        employee_results.append(enriched)

        # Group by state
        state = emp["state_of_residence"]
        if state not in state_groups:
            state_groups[state] = {
                "employees": [],
                "total_gross": 0.0,
                "total_paye": 0.0,
                "total_pension": 0.0,
                "total_nhf": 0.0,
            }
        group = state_groups[state]
        group["employees"].append(enriched)
        group["total_gross"] = bankers_round(group["total_gross"] + paye_result["gross_annual"])
        group["total_paye"] = bankers_round(group["total_paye"] + paye_result["annual_paye"])
        group["total_pension"] = bankers_round(
            group["total_pension"] + paye_result["pension"]["employee"]
        )
        group["total_nhf"] = bankers_round(group["total_nhf"] + paye_result["nhf"])

    # ── Build per-state summaries ──
    by_state: dict[str, StatePayrollSummary] = {}
    today = f"{current_year}-{datetime.date.today().month:02d}-01"

    for state_code, group in state_groups.items():
        state_data = get(f"state_filing.jurisdictions.{state_code}")

        by_state[state_code] = StatePayrollSummary(
            state_code=state_code,  # type: ignore[arg-type]
            state_name=state_data["name"],  # type: ignore[index]
            irs_name=state_data["irsName"],  # type: ignore[index]
            employee_count=len(group["employees"]),
            total_gross=group["total_gross"],
            total_paye=group["total_paye"],
            total_pension=group["total_pension"],
            total_nhf=group["total_nhf"],
            filing_methods=state_data["filingMethods"],  # type: ignore[index]
            portal_url=state_data["portalUrl"],  # type: ignore[index]
            email=state_data["email"],  # type: ignore[index]
            address=state_data["address"],  # type: ignore[index]
            monthly_remittance_deadline=get_remittance_deadline(today, 10),
            form_h1_deadline=_get_form_h1_deadline(current_year),
        )

    # ── Compute aggregate totals ──
    totals = PayrollTotals(
        total_gross=0.0,
        total_paye=0.0,
        total_pension=0.0,
        total_nhf=0.0,
        employee_count=len(employees),
    )

    for group in state_groups.values():
        totals["total_gross"] = bankers_round(totals["total_gross"] + group["total_gross"])
        totals["total_paye"] = bankers_round(totals["total_paye"] + group["total_paye"])
        totals["total_pension"] = bankers_round(totals["total_pension"] + group["total_pension"])
        totals["total_nhf"] = bankers_round(totals["total_nhf"] + group["total_nhf"])

    return PayrollBatchResult(
        employees=employee_results,
        by_state=by_state,
        totals=totals,
    )
