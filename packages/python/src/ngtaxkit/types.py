"""Type definitions for ngtaxkit — snake_case equivalents of TypeScript types."""

from __future__ import annotations

from typing import Literal, TypedDict

# ─── Literal Types ────────────────────────────────────────────────────────────

TaxCategory = Literal[
    "standard",
    "basic-food",
    "medicine",
    "medical-equipment",
    "medical-services",
    "educational-books",
    "tuition",
    "electricity",
    "export-services",
    "humanitarian-goods",
    "residential-rent",
    "public-transport",
    "financial-services",
    "insurance",
]

WhtServiceType = Literal[
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

NigerianState = Literal[
    "AB", "AD", "AK", "AN", "BA", "BY", "BE", "BO",
    "CR", "DE", "EB", "ED", "EK", "EN", "FC", "GO",
    "IM", "JI", "KD", "KN", "KT", "KE", "KO", "KW",
    "LA", "NA", "NI", "OG", "ON", "OS", "OY", "PL",
    "RI", "SO", "TA", "YO", "ZA",
]

PayeeType = Literal["individual", "company"]
BuyerType = Literal["individual", "business"]
RateType = Literal["standard", "zero-rated", "exempt"]

# ─── Supporting Types ─────────────────────────────────────────────────────────


class TaxBand(TypedDict):
    lower: float
    upper: float
    rate: float
    tax_in_band: float


class CommissionBreakdown(TypedDict):
    rate: float
    amount: float
    vat_on_commission: float
    net_commission: float


class VatLiability(TypedDict):
    collected_by: Literal["seller", "platform"]
    amount: float
    remitted_by: Literal["seller", "platform"]


class TransactionBreakdown(TypedDict):
    sale_amount: float
    vat_amount: float
    commission_amount: float
    wht_amount: float
    seller_payout: float
    total_from_buyer: float


class ReliefBreakdown(TypedDict):
    consolidated_relief: float
    rent_relief: float
    pension_relief: float
    nhf_relief: float
    total: float


class MonthlyDeductions(TypedDict):
    paye: float
    pension: float
    nhf: float
    total: float


class EmployerCosts(TypedDict):
    pension: float
    nsitf: float
    itf: float
    total: float


class PensionContributions(TypedDict):
    employee: float
    employer: float


# ─── Result Types ─────────────────────────────────────────────────────────────


class VatResult(TypedDict):
    net: float
    vat: float
    gross: float
    rate: float
    rate_type: RateType
    category: TaxCategory
    legal_basis: str
    input_vat_recoverable: bool


class PayeResult(TypedDict):
    gross_annual: float
    gross_monthly: float
    pension: PensionContributions
    nhf: float
    reliefs: ReliefBreakdown
    taxable_income: float
    tax_bands: list[TaxBand]
    annual_paye: float
    monthly_paye: float
    effective_rate: float
    exempt: bool
    exemption_basis: str | None
    net_monthly: float
    monthly_deductions: MonthlyDeductions
    employer_costs: EmployerCosts
    legal_basis: str


class WhtResult(TypedDict):
    gross_amount: float
    rate: float
    wht_amount: float
    net_payment: float
    exempt: bool
    exemption_basis: str | None
    remittance_deadline: str
    credit_note_required: bool
    legal_basis: str


class PensionResult(TypedDict):
    pensionable_earnings: float
    employee_contribution: float
    employer_contribution: float
    total_contribution: float
    remittance_deadline: str
    remittance_method: str
    legal_basis: str


class NhfResult(TypedDict):
    nhf_amount: float
    rate: float
    base: Literal["basicSalary"]
    legal_basis: str


class NsitfResult(TypedDict):
    nsitf_amount: float
    rate: float
    base: Literal["monthlyPayroll"]
    contributor_type: str
    legal_basis: str


class ItfResult(TypedDict):
    itf_amount: float
    rate: float
    eligible: bool
    eligibility_basis: Literal["employeeCount", "annualTurnover"] | None
    refund_amount: float
    legal_basis: str


class AllStatutoryResult(TypedDict):
    nhf: NhfResult
    nsitf: NsitfResult
    itf: ItfResult


class MarketplaceResult(TypedDict):
    sale_amount: float
    vat: VatResult
    total_from_buyer: float
    platform_commission: CommissionBreakdown
    seller_payout: float
    wht: WhtResult | None
    vat_liability: VatLiability
    breakdown: TransactionBreakdown


class StatePayrollSummary(TypedDict):
    state_code: NigerianState
    state_name: str
    irs_name: str
    employee_count: int
    total_gross: float
    total_paye: float
    total_pension: float
    total_nhf: float
    filing_methods: list[str]
    portal_url: str | None
    email: str | None
    address: str | None
    monthly_remittance_deadline: str
    form_h1_deadline: str


class PayrollTotals(TypedDict):
    total_gross: float
    total_paye: float
    total_pension: float
    total_nhf: float
    employee_count: int


class PayrollEmployeeResult(PayeResult):
    id: str | None
    name: str
    state_of_residence: NigerianState


class PayrollBatchResult(TypedDict):
    employees: list[PayrollEmployeeResult]
    by_state: dict[str, StatePayrollSummary]
    totals: PayrollTotals
