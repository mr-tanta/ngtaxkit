"""Property-based tests using Hypothesis — Python port of TypeScript fast-check properties.

Validates: Requirements 35.1 through 35.6
"""

from __future__ import annotations

import math

from hypothesis import given, settings
from hypothesis import strategies as st

from ngtaxkit import marketplace, paye, payroll, pension, statutory, vat, wht
from ngtaxkit.utils import bankers_round

# ─── Shared Strategies ───────────────────────────────────────────────────────

VALID_STATES = [
    "AB", "AD", "AK", "AN", "BA", "BY", "BE", "BO",
    "CR", "DE", "EB", "ED", "EK", "EN", "FC", "GO",
    "IM", "JI", "KD", "KN", "KT", "KE", "KO", "KW",
    "LA", "NA", "NI", "OG", "ON", "OS", "OY", "PL",
    "RI", "SO", "TA", "YO", "ZA",
]

SERVICE_TYPES = [
    "professional", "management", "technical", "consultancy", "commission",
    "construction", "contract", "rent", "royalty", "dividend", "interest",
]

MARKETPLACE_CATEGORIES = ["standard", "basic-food", "medicine", "residential-rent"]


# ─── Property 1: VAT additive — net + vat === gross ─────────────────────────
# **Validates: Requirements 1.1, 35.1**


class TestVatAdditiveProperty:
    @settings(max_examples=500)
    @given(amount=st.floats(min_value=0, max_value=1_000_000_000, allow_nan=False, allow_infinity=False))
    def test_net_plus_vat_equals_gross(self, amount: float) -> None:
        """Property 1: For all non-negative amounts, calculate(x).net + calculate(x).vat === calculate(x).gross."""
        result = vat.calculate(amount=amount, category="standard")
        total = bankers_round(result["net"] + result["vat"])
        assert total == result["gross"]


# ─── Property 2: PAYE monthly-annual — monthlyPaye × 12 ≈ annualPaye ────────
# **Validates: Requirements 2.8, 35.2**


class TestPayeMonthlyAnnualProperty:
    @settings(max_examples=500)
    @given(gross_annual=st.integers(min_value=0, max_value=100_000_000))
    def test_monthly_times_12_approx_annual(self, gross_annual: int) -> None:
        """Property 2: For all valid gross annual incomes, monthlyPaye * 12 ≈ annualPaye (within ±0.12 kobo)."""
        result = paye.calculate(gross_annual=float(gross_annual))
        monthly_times_12 = bankers_round(result["monthly_paye"] * 12)
        assert abs(monthly_times_12 - result["annual_paye"]) <= 0.12


# ─── Property 3: WHT additive — grossAmount === netPayment + whtAmount ───────
# **Validates: Requirements 3.1, 35.3**


class TestWhtAdditiveProperty:
    @settings(max_examples=500)
    @given(
        amount=st.integers(min_value=0, max_value=10_000_000_000).map(lambda n: n / 100),
        payee_type=st.sampled_from(["individual", "company"]),
        service_type=st.sampled_from(SERVICE_TYPES),
        payee_is_small_company=st.booleans(),
    )
    def test_gross_equals_net_plus_wht(
        self,
        amount: float,
        payee_type: str,
        service_type: str,
        payee_is_small_company: bool,
    ) -> None:
        """Property 3: For all valid WHT inputs, grossAmount === netPayment + whtAmount."""
        result = wht.calculate(
            amount=amount,
            payee_type=payee_type,
            service_type=service_type,
            payee_is_small_company=payee_is_small_company,
            payment_date="2026-06-15",
        )
        assert bankers_round(result["net_payment"] + result["wht_amount"]) == result["gross_amount"]


# ─── Property 4: Marketplace balance invariant ───────────────────────────────
# **Validates: Requirements 6.5, 35.4**


class TestMarketplaceBalanceProperty:
    @settings(max_examples=500)
    @given(
        sale_amount=st.integers(min_value=1, max_value=100_000_000),
        commission_rate=st.integers(min_value=1, max_value=50).map(lambda n: n / 100),
        seller_vat_registered=st.booleans(),
        category=st.sampled_from(MARKETPLACE_CATEGORIES),
        platform_is_vat_agent=st.booleans(),
    )
    def test_balance_invariant(
        self,
        sale_amount: int,
        commission_rate: float,
        seller_vat_registered: bool,
        category: str,
        platform_is_vat_agent: bool,
    ) -> None:
        """Property 4: For all valid marketplace transactions, totalFromBuyer === sellerPayout + commission + VAT + WHT."""
        result = marketplace.calculate_transaction(
            sale_amount=float(sale_amount),
            platform_commission=commission_rate,
            seller_vat_registered=seller_vat_registered,
            buyer_type="individual",
            service_category=category,
            platform_is_vat_agent=platform_is_vat_agent,
        )
        wht_amount = result["wht"]["wht_amount"] if result["wht"] else 0
        total = bankers_round(
            result["seller_payout"]
            + result["platform_commission"]["amount"]
            + result["vat"]["vat"]
            + wht_amount
        )
        assert total == result["total_from_buyer"]


# ─── Property 5: Universal non-negativity ────────────────────────────────────
# **Validates: Requirements 35.5, 35.6**


class TestNonNegativityProperty:
    @settings(max_examples=200)
    @given(amount=st.floats(min_value=0, max_value=1_000_000_000, allow_nan=False, allow_infinity=False))
    def test_vat_non_negative(self, amount: float) -> None:
        """All VAT output amounts are >= 0 for non-negative inputs."""
        result = vat.calculate(amount=amount, category="standard")
        assert result["net"] >= 0
        assert result["vat"] >= 0
        assert result["gross"] >= 0
        assert result["rate"] >= 0

    @settings(max_examples=200)
    @given(
        gross_annual=st.integers(min_value=0, max_value=100_000_000),
        pension_contributing=st.booleans(),
        nhf_contributing=st.booleans(),
    )
    def test_paye_non_negative(
        self, gross_annual: int, pension_contributing: bool, nhf_contributing: bool
    ) -> None:
        """All PAYE output amounts are >= 0 for non-negative inputs."""
        result = paye.calculate(
            gross_annual=float(gross_annual),
            pension_contributing=pension_contributing,
            nhf_contributing=nhf_contributing,
        )
        assert result["gross_annual"] >= 0
        assert result["gross_monthly"] >= 0
        assert result["annual_paye"] >= 0
        assert result["monthly_paye"] >= 0
        assert result["taxable_income"] >= 0
        assert result["pension"]["employee"] >= 0
        assert result["pension"]["employer"] >= 0
        assert result["nhf"] >= 0
        assert result["effective_rate"] >= 0
        assert result["reliefs"]["total"] >= 0

    @settings(max_examples=200)
    @given(
        basic_salary=st.integers(min_value=0, max_value=50_000_000),
        housing_allowance=st.integers(min_value=0, max_value=20_000_000),
        transport_allowance=st.integers(min_value=0, max_value=10_000_000),
    )
    def test_pension_non_negative(
        self, basic_salary: int, housing_allowance: int, transport_allowance: int
    ) -> None:
        """All pension output amounts are >= 0 for non-negative inputs."""
        result = pension.calculate(
            basic_salary=float(basic_salary),
            housing_allowance=float(housing_allowance),
            transport_allowance=float(transport_allowance),
        )
        assert result["pensionable_earnings"] >= 0
        assert result["employee_contribution"] >= 0
        assert result["employer_contribution"] >= 0
        assert result["total_contribution"] >= 0

    @settings(max_examples=200)
    @given(basic_salary=st.integers(min_value=0, max_value=50_000_000))
    def test_nhf_non_negative(self, basic_salary: int) -> None:
        """NHF amount is >= 0 for non-negative basicSalary."""
        result = statutory.nhf(basic_salary=float(basic_salary))
        assert result["nhf_amount"] >= 0

    @settings(max_examples=200)
    @given(monthly_payroll=st.integers(min_value=0, max_value=50_000_000))
    def test_nsitf_non_negative(self, monthly_payroll: int) -> None:
        """NSITF amount is >= 0 for non-negative monthlyPayroll."""
        result = statutory.nsitf(monthly_payroll=float(monthly_payroll))
        assert result["nsitf_amount"] >= 0

    @settings(max_examples=200)
    @given(
        annual_payroll=st.integers(min_value=0, max_value=500_000_000),
        employee_count=st.integers(min_value=0, max_value=1000),
    )
    def test_itf_non_negative(self, annual_payroll: int, employee_count: int) -> None:
        """ITF amount and refund are >= 0 for non-negative inputs."""
        result = statutory.itf(
            annual_payroll=float(annual_payroll),
            employee_count=employee_count,
        )
        assert result["itf_amount"] >= 0
        assert result["refund_amount"] >= 0

    @settings(max_examples=200)
    @given(
        employees=st.lists(
            st.fixed_dictionaries({
                "name": st.just("Employee"),
                "gross_annual": st.integers(min_value=0, max_value=100_000_000).map(float),
                "state_of_residence": st.sampled_from(VALID_STATES),
                "pension_contributing": st.booleans(),
                "nhf_contributing": st.booleans(),
            }),
            min_size=1,
            max_size=5,
        ),
    )
    def test_payroll_non_negative(self, employees: list[dict]) -> None:
        """All payroll totals and employee results are >= 0 for non-negative inputs."""
        result = payroll.calculate_batch(employees)

        assert result["totals"]["total_gross"] >= 0
        assert result["totals"]["total_paye"] >= 0
        assert result["totals"]["total_pension"] >= 0
        assert result["totals"]["total_nhf"] >= 0

        for emp in result["employees"]:
            assert emp["gross_annual"] >= 0
            assert emp["annual_paye"] >= 0
            assert emp["monthly_paye"] >= 0
            assert emp["pension"]["employee"] >= 0
            assert emp["pension"]["employer"] >= 0
            assert emp["nhf"] >= 0

        for summary in result["by_state"].values():
            assert summary["total_gross"] >= 0
            assert summary["total_paye"] >= 0
            assert summary["total_pension"] >= 0
            assert summary["total_nhf"] >= 0
