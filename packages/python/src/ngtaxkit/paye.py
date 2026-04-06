"""PAYE Module — Pure-function PAYE calculation engine per NTA 2025."""

from __future__ import annotations

from .errors import InvalidAmountError
from .rates import get
from .types import (
    EmployerCosts,
    MonthlyDeductions,
    PayeResult,
    PensionContributions,
    ReliefBreakdown,
    TaxBand,
)
from .utils import bankers_round

# ─── Internal Helpers ─────────────────────────────────────────────────────────


def _load_brackets() -> list[dict]:
    """Load PAYE brackets from the rates registry."""
    bands = get("paye.bands")
    return [
        {
            "lower": b["lower"],
            "upper": b["upper"],
            "rate": b["rate"],
        }
        for b in bands  # type: ignore[union-attr]
    ]


def _apply_bands(taxable_income: float, brackets: list[dict]) -> list[TaxBand]:
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
    if gross_annual < 0:
        raise InvalidAmountError(
            f"Gross annual income must be non-negative, received {gross_annual}"
        )

    exemption_threshold: float = get("paye.exemptionThreshold")  # type: ignore[assignment]
    legal_basis: str = get("paye.legalBasis")  # type: ignore[assignment]
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
            exemption_basis=get("paye.exemptionBasis"),  # type: ignore[arg-type]
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
    min_employee_rate: float = get("pension.minimumRates.employee")  # type: ignore[assignment]
    min_employer_rate: float = get("pension.minimumRates.employer")  # type: ignore[assignment]
    nhf_rate: float = get("statutory.nhf.rate")  # type: ignore[assignment]

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
    nsitf_rate: float = get("statutory.nsitf.rate")  # type: ignore[assignment]
    itf_rate: float = get("statutory.itf.rate")  # type: ignore[assignment]
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


def is_exempt(gross_annual: float, tax_year: int | None = None) -> bool:
    """Check if a gross annual income is exempt from PAYE."""
    threshold: float = get("paye.exemptionThreshold")  # type: ignore[assignment]
    return gross_annual <= threshold


def get_brackets(tax_year: int | None = None) -> list[dict]:
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
    # CRA: max(₦200K, 1% of gross) + 20% of gross
    cra_fixed: float = get("paye.cra.fixedAmount")  # type: ignore[assignment]
    cra_percent: float = get("paye.cra.percentOfGross")  # type: ignore[assignment]
    cra_additional: float = get("paye.cra.additionalPercentOfGross")  # type: ignore[assignment]
    consolidated_relief = bankers_round(
        max(cra_fixed, gross_annual * cra_percent) + gross_annual * cra_additional
    )

    # Pension relief: 8% of gross (if contributing)
    min_employee_rate: float = get("pension.minimumRates.employee")  # type: ignore[assignment]
    pension_relief = bankers_round(gross_annual * min_employee_rate) if pension_contributing else 0.0

    # NHF relief: 2.5% of gross (if contributing)
    nhf_rate: float = get("statutory.nhf.rate")  # type: ignore[assignment]
    nhf_relief = bankers_round(gross_annual * nhf_rate) if nhf_contributing else 0.0

    # Rent relief: 20% of rent paid, capped at ₦500K
    rent_relief_rate: float = get("paye.rentRelief.rate")  # type: ignore[assignment]
    rent_relief_cap: float = get("paye.rentRelief.cap")  # type: ignore[assignment]
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
