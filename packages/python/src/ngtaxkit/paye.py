"""PAYE Module — Pure-function PAYE calculation engine per NTA 2025."""

from __future__ import annotations

from typing import Any, TypedDict, cast

from .explain import collect_rate_sources, unique_rate_keys
from .rates import get_float, get_list, get_str
from .types import (
    CalculationExplanation,
    EmployerCosts,
    MonthlyDeductions,
    PayeResult,
    PensionContributions,
    ReliefBreakdown,
    TaxBand,
)
from .utils import assert_non_negative_finite, bankers_round

# ─── Internal Helpers ─────────────────────────────────────────────────────────


class _PayeBracket(TypedDict):
    lower: float
    upper: float | None
    rate: float


def _load_brackets() -> list[_PayeBracket]:
    """Load PAYE brackets from the rates registry."""
    bands = get_list("paye.bands")
    brackets: list[_PayeBracket] = []
    for raw_band in bands:
        band = cast(dict[str, Any], raw_band)
        upper = band["upper"]
        brackets.append(
            _PayeBracket(
                lower=float(band["lower"]),
                upper=float(upper) if upper is not None else None,
                rate=float(band["rate"]),
            )
        )
    return brackets


def _apply_bands(taxable_income: float, brackets: list[_PayeBracket]) -> list[TaxBand]:
    """Apply graduated tax bands to taxable income and return per-band breakdown."""
    result: list[TaxBand] = []
    for band in brackets:
        upper = band["upper"] if band["upper"] is not None else float("inf")
        income_in_band = max(0.0, min(taxable_income, upper) - band["lower"])
        tax_in_band = bankers_round(income_in_band * band["rate"])
        result.append(
            TaxBand(
                lower=band["lower"],
                upper=upper,
                rate=band["rate"],
                tax_in_band=tax_in_band,
            )
        )
    return result


# ─── Public API ───────────────────────────────────────────────────────────────


def calculate(
    gross_annual: float,
    pension_contributing: bool = False,
    nhf_contributing: bool = False,
    rent_paid_annual: float = 0.0,
    disability_status: bool = False,
    tax_year: int | None = None,
) -> PayeResult:
    """Calculate PAYE for a given gross annual income."""
    assert_non_negative_finite("gross_annual", gross_annual)
    assert_non_negative_finite("rent_paid_annual", rent_paid_annual)

    exemption_threshold = get_float("paye.exemptionThreshold")
    legal_basis = get_str("paye.legalBasis")
    brackets = _load_brackets()

    # ── Exemption check ──
    if gross_annual <= exemption_threshold:
        gross_monthly = bankers_round(gross_annual / 12)
        return PayeResult(
            gross_annual=gross_annual,
            gross_monthly=gross_monthly,
            pension=PensionContributions(employee=0.0, employer=0.0),
            nhf=0.0,
            reliefs=ReliefBreakdown(
                consolidated_relief=0.0,
                rent_relief=0.0,
                pension_relief=0.0,
                nhf_relief=0.0,
                total=0.0,
            ),
            taxable_income=0.0,
            tax_bands=_apply_bands(0.0, brackets),
            annual_paye=0.0,
            monthly_paye=0.0,
            effective_rate=0.0,
            exempt=True,
            exemption_basis=get_str("paye.exemptionBasis"),
            net_monthly=gross_monthly,
            monthly_deductions=MonthlyDeductions(paye=0.0, pension=0.0, nhf=0.0, total=0.0),
            employer_costs=EmployerCosts(pension=0.0, nsitf=0.0, itf=0.0, total=0.0),
            legal_basis=legal_basis,
        )

    # ── Reliefs ──
    reliefs = calculate_relief(
        gross_annual=gross_annual,
        pension_contributing=pension_contributing,
        nhf_contributing=nhf_contributing,
        rent_paid_annual=rent_paid_annual,
    )

    # ── Taxable income ──
    taxable_income = bankers_round(max(0.0, gross_annual - reliefs["total"]))

    # ── Apply graduated bands ──
    tax_bands = _apply_bands(taxable_income, brackets)
    annual_paye = bankers_round(sum(b["tax_in_band"] for b in tax_bands))

    # ── Monthly values ──
    gross_monthly = bankers_round(gross_annual / 12)
    monthly_paye = bankers_round(annual_paye / 12)

    # ── Effective rate (4dp) ──
    effective_rate = round(annual_paye / gross_annual, 4) if gross_annual > 0 else 0.0

    # ── Pension & NHF amounts ──
    min_employee_rate = get_float("pension.minimumRates.employee")
    min_employer_rate = get_float("pension.minimumRates.employer")
    nhf_rate = get_float("statutory.nhf.rate")

    employee_pension = bankers_round(gross_annual * min_employee_rate) if pension_contributing else 0.0
    employer_pension = bankers_round(gross_annual * min_employer_rate) if pension_contributing else 0.0
    nhf_amount = bankers_round(gross_annual * nhf_rate) if nhf_contributing else 0.0

    # ── Monthly deductions ──
    monthly_employee_pension = bankers_round(employee_pension / 12)
    monthly_nhf = bankers_round(nhf_amount / 12)
    total_monthly_deductions = bankers_round(monthly_paye + monthly_employee_pension + monthly_nhf)
    monthly_deductions = MonthlyDeductions(
        paye=monthly_paye,
        pension=monthly_employee_pension,
        nhf=monthly_nhf,
        total=total_monthly_deductions,
    )

    # ── Net monthly ──
    net_monthly = bankers_round(gross_monthly - total_monthly_deductions)

    # ── Employer costs ──
    monthly_employer_pension = bankers_round(employer_pension / 12)
    nsitf_rate = get_float("statutory.nsitf.rate")
    itf_rate = get_float("statutory.itf.rate")
    monthly_nsitf = bankers_round(gross_monthly * nsitf_rate)
    monthly_itf = bankers_round(gross_monthly * itf_rate)
    employer_costs = EmployerCosts(
        pension=monthly_employer_pension,
        nsitf=monthly_nsitf,
        itf=monthly_itf,
        total=bankers_round(monthly_employer_pension + monthly_nsitf + monthly_itf),
    )

    return PayeResult(
        gross_annual=gross_annual,
        gross_monthly=gross_monthly,
        pension=PensionContributions(employee=employee_pension, employer=employer_pension),
        nhf=nhf_amount,
        reliefs=reliefs,
        taxable_income=taxable_income,
        tax_bands=tax_bands,
        annual_paye=annual_paye,
        monthly_paye=monthly_paye,
        effective_rate=effective_rate,
        exempt=False,
        exemption_basis=None,
        net_monthly=net_monthly,
        monthly_deductions=monthly_deductions,
        employer_costs=employer_costs,
        legal_basis=legal_basis,
    )


def explain_calculate(
    gross_annual: float,
    pension_contributing: bool = False,
    nhf_contributing: bool = False,
    rent_paid_annual: float = 0.0,
    disability_status: bool = False,
    tax_year: int | None = None,
) -> CalculationExplanation:
    """Calculate PAYE and return the source-backed reasoning used for the result."""
    result = calculate(
        gross_annual=gross_annual,
        pension_contributing=pension_contributing,
        nhf_contributing=nhf_contributing,
        rent_paid_annual=rent_paid_annual,
        disability_status=disability_status,
        tax_year=tax_year,
    )

    rate_keys = [
        "paye.exemptionThreshold",
        "paye.cra.fixedAmount",
        "paye.cra.percentOfGross",
        "paye.cra.additionalPercentOfGross",
        "paye.rentRelief.rate",
        "paye.rentRelief.cap",
        "paye.bands",
    ]
    if pension_contributing:
        rate_keys.extend([
            "pension.minimumRates.employee",
            "pension.minimumRates.employer",
        ])
    if nhf_contributing:
        rate_keys.append("statutory.nhf.rate")
    if not result["exempt"]:
        rate_keys.extend(["statutory.nsitf.rate", "statutory.itf.rate"])

    rate_keys = unique_rate_keys(rate_keys)
    sources, warnings = collect_rate_sources(rate_keys)

    if result["exempt"]:
        formula = [
            f"Gross annual income = {gross_annual}.",
            "Gross annual income is at or below the exemption threshold, so annual PAYE is 0.",
            "Monthly PAYE = 0.",
        ]
    else:
        formula = [
            f"Gross annual income = {gross_annual}.",
            "Consolidated relief = max(CRA fixed amount, gross annual income * CRA minimum percent) + gross annual income * CRA additional percent.",
            "Rent relief = min(rent paid * rent relief rate, rent relief cap).",
            "Taxable income = gross annual income - total reliefs.",
            "Annual PAYE = sum of taxable income portions multiplied by the graduated PAYE band rates.",
            "Monthly PAYE = annual PAYE / 12.",
        ]

    if pension_contributing:
        formula.append("Employee pension deduction = gross annual income * employee pension rate.")
        formula.append("Employer pension cost = gross annual income * employer pension rate.")
    if nhf_contributing:
        formula.append("NHF deduction = gross annual income * NHF rate.")

    assumptions = [
        "Amounts are denominated in Nigerian naira.",
        "Monetary values use banker's rounding to 2 decimal places.",
        "Bundled 2026 PAYE rates are used for this calculation.",
    ]
    if tax_year is not None:
        assumptions.append(
            "tax_year is accepted for API compatibility; the current bundled registry does not switch PAYE rate files by year."
        )
    if disability_status:
        assumptions.append(
            "disability_status is accepted for API compatibility; the current bundled registry does not add a disability-specific relief."
        )

    return CalculationExplanation(
        inputs={
            "gross_annual": gross_annual,
            "pension_contributing": pension_contributing,
            "nhf_contributing": nhf_contributing,
            "rent_paid_annual": rent_paid_annual,
            "disability_status": disability_status,
            "tax_year": tax_year,
        },
        result=result,
        formula=formula,
        assumptions=assumptions,
        rate_keys=rate_keys,
        sources=sources,
        warnings=warnings,
    )


def is_exempt(gross_annual: float, tax_year: int | None = None) -> bool:
    """Check if a gross annual income is exempt from PAYE."""
    assert_non_negative_finite("gross_annual", gross_annual)
    threshold = get_float("paye.exemptionThreshold")
    return gross_annual <= threshold


def get_brackets(tax_year: int | None = None) -> list[_PayeBracket]:
    """Get the PAYE graduated tax brackets for a given tax year."""
    return _load_brackets()


def calculate_relief(
    gross_annual: float,
    pension_contributing: bool = False,
    nhf_contributing: bool = False,
    rent_paid_annual: float = 0.0,
    disability_status: bool = False,
    tax_year: int | None = None,
) -> ReliefBreakdown:
    """Calculate all PAYE reliefs for the given options."""
    assert_non_negative_finite("gross_annual", gross_annual)
    assert_non_negative_finite("rent_paid_annual", rent_paid_annual)

    # CRA: max(₦200K, 1% of gross) + 20% of gross
    cra_fixed = get_float("paye.cra.fixedAmount")
    cra_percent = get_float("paye.cra.percentOfGross")
    cra_additional = get_float("paye.cra.additionalPercentOfGross")
    consolidated_relief = bankers_round(
        max(cra_fixed, gross_annual * cra_percent) + gross_annual * cra_additional
    )

    # Pension relief: 8% of gross (if contributing)
    min_employee_rate = get_float("pension.minimumRates.employee")
    pension_relief = bankers_round(gross_annual * min_employee_rate) if pension_contributing else 0.0

    # NHF relief: 2.5% of gross (if contributing)
    nhf_rate = get_float("statutory.nhf.rate")
    nhf_relief = bankers_round(gross_annual * nhf_rate) if nhf_contributing else 0.0

    # Rent relief: 20% of rent paid, capped at ₦500K
    rent_relief_rate = get_float("paye.rentRelief.rate")
    rent_relief_cap = get_float("paye.rentRelief.cap")
    rent_relief = (
        bankers_round(min(rent_paid_annual * rent_relief_rate, rent_relief_cap))
        if rent_paid_annual > 0
        else 0.0
    )

    total = bankers_round(consolidated_relief + pension_relief + nhf_relief + rent_relief)

    return ReliefBreakdown(
        consolidated_relief=consolidated_relief,
        rent_relief=rent_relief,
        pension_relief=pension_relief,
        nhf_relief=nhf_relief,
        total=total,
    )
