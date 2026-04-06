"""Smoke tests for all ngtaxkit Python modules."""

import pytest

from ngtaxkit import errors, marketplace, paye, payroll, pension, rates, statutory, vat, wht
from ngtaxkit.utils import bankers_round


class TestUtils:
    def test_bankers_round_basic(self):
        assert bankers_round(1.005) == 1.0  # round-half-even: 0 is even
        assert bankers_round(1.015) == 1.02  # round-half-even: 2 is even
        assert bankers_round(1.025) == 1.02  # round-half-even: 2 is even
        assert bankers_round(1.035) == 1.04  # round-half-even: 4 is even
        assert bankers_round(100.456) == 100.46

    def test_bankers_round_monetary(self):
        assert bankers_round(1000 * 0.075) == 75.0
        assert bankers_round(99.99) == 99.99


class TestErrors:
    def test_base_error(self):
        err = errors.NgtaxkitError("TEST_CODE", "test message", "Section 1")
        assert err.code == "TEST_CODE"
        assert str(err) == "test message"
        assert err.legal_basis == "Section 1"
        j = err.to_json()
        assert j["code"] == "TEST_CODE"
        assert j["message"] == "test message"
        assert j["legal_basis"] == "Section 1"

    def test_invalid_amount_is_value_error(self):
        err = errors.InvalidAmountError("bad amount")
        assert isinstance(err, ValueError)
        assert isinstance(err, errors.NgtaxkitError)

    def test_rate_not_found_is_key_error(self):
        err = errors.RateNotFoundError("not found")
        assert isinstance(err, KeyError)
        assert isinstance(err, errors.NgtaxkitError)


class TestRates:
    def test_get_vat_standard_rate(self):
        assert rates.get("vat.standard.rate") == 0.075

    def test_get_paye_exemption(self):
        assert rates.get("paye.exemptionThreshold") == 800000

    def test_get_version(self):
        assert rates.get_version() == "2026.1.0"

    def test_get_effective_date(self):
        assert rates.get_effective_date() == "2026-01-01"

    def test_set_custom(self):
        rates.set_custom({"vat.standard.rate": 0.10})
        assert rates.get("vat.standard.rate") == 0.10
        rates.clear_custom()
        assert rates.get("vat.standard.rate") == 0.075

    def test_rate_not_found(self):
        with pytest.raises(errors.RateNotFoundError):
            rates.get("nonexistent.key")


class TestVat:
    def test_standard_calculate(self):
        result = vat.calculate(amount=1000.0)
        assert result["net"] == 1000.0
        assert result["vat"] == 75.0
        assert result["gross"] == 1075.0
        assert result["rate"] == 0.075
        assert result["rate_type"] == "standard"
        assert result["input_vat_recoverable"] is True

    def test_inclusive_extract(self):
        result = vat.extract(amount=1075.0)
        assert result["net"] == 1000.0
        assert result["vat"] == 75.0
        assert result["gross"] == 1075.0

    def test_zero_rated(self):
        result = vat.calculate(amount=500.0, category="basic-food")
        assert result["vat"] == 0.0
        assert result["rate_type"] == "zero-rated"
        assert result["input_vat_recoverable"] is True

    def test_exempt(self):
        result = vat.calculate(amount=500.0, category="residential-rent")
        assert result["vat"] == 0.0
        assert result["rate_type"] == "exempt"
        assert result["input_vat_recoverable"] is False

    def test_negative_amount_raises(self):
        with pytest.raises(errors.InvalidAmountError):
            vat.calculate(amount=-100.0)

    def test_invalid_category_raises(self):
        with pytest.raises(errors.InvalidCategoryError):
            vat.calculate(amount=100.0, category="invalid")

    def test_is_taxable(self):
        assert vat.is_taxable("standard") is True
        assert vat.is_taxable("basic-food") is False

    def test_list_categories(self):
        cats = vat.list_categories()
        assert "standard" in cats
        assert "basic-food" in cats
        assert len(cats) == 14

    def test_additive_identity(self):
        """net + vat == gross for standard calculation."""
        result = vat.calculate(amount=12345.67)
        assert bankers_round(result["net"] + result["vat"]) == result["gross"]


class TestPaye:
    def test_exempt_income(self):
        result = paye.calculate(gross_annual=800000.0)
        assert result["annual_paye"] == 0.0
        assert result["exempt"] is True

    def test_above_exemption(self):
        result = paye.calculate(gross_annual=5000000.0)
        assert result["annual_paye"] > 0
        assert result["exempt"] is False
        assert result["effective_rate"] > 0
        assert result["effective_rate"] <= 0.24

    def test_monthly_annual_consistency(self):
        result = paye.calculate(gross_annual=5000000.0)
        assert result["monthly_paye"] == bankers_round(result["annual_paye"] / 12)

    def test_negative_raises(self):
        with pytest.raises(errors.InvalidAmountError):
            paye.calculate(gross_annual=-1.0)

    def test_is_exempt(self):
        assert paye.is_exempt(800000.0) is True
        assert paye.is_exempt(800001.0) is False


class TestWht:
    def test_professional_individual(self):
        result = wht.calculate(
            amount=100000.0,
            payee_type="individual",
            service_type="professional",
            payment_date="2026-01-15",
        )
        assert result["rate"] == 0.05
        assert result["wht_amount"] == 5000.0
        assert result["net_payment"] == 95000.0
        assert result["credit_note_required"] is True

    def test_professional_company(self):
        result = wht.calculate(
            amount=100000.0,
            payee_type="company",
            service_type="professional",
            payment_date="2026-01-15",
        )
        assert result["rate"] == 0.10
        assert result["wht_amount"] == 10000.0

    def test_small_company_exemption(self):
        result = wht.calculate(
            amount=2000000.0,
            payee_type="company",
            service_type="professional",
            payee_is_small_company=True,
            payment_date="2026-01-15",
        )
        assert result["exempt"] is True
        assert result["wht_amount"] == 0.0

    def test_invalid_service_type(self):
        with pytest.raises(errors.InvalidServiceTypeError):
            wht.calculate(amount=1000.0, payee_type="individual", service_type="invalid")

    def test_list_service_types(self):
        types = wht.list_service_types()
        assert "professional" in types
        assert len(types) == 11

    def test_gross_equals_net_plus_wht(self):
        result = wht.calculate(
            amount=100000.0,
            payee_type="individual",
            service_type="professional",
            payment_date="2026-01-15",
        )
        assert result["gross_amount"] == bankers_round(
            result["net_payment"] + result["wht_amount"]
        )


class TestPension:
    def test_basic_calculation(self):
        result = pension.calculate(
            basic_salary=200000.0,
            housing_allowance=100000.0,
            transport_allowance=50000.0,
            salary_payment_date="2026-01-05",
        )
        assert result["pensionable_earnings"] == 350000.0
        assert result["employee_contribution"] == bankers_round(350000.0 * 0.08)
        assert result["employer_contribution"] == bankers_round(350000.0 * 0.10)
        assert result["total_contribution"] == bankers_round(
            result["employee_contribution"] + result["employer_contribution"]
        )
        assert result["remittance_method"] == "PFA transfer"

    def test_invalid_employee_rate(self):
        with pytest.raises(errors.InvalidPensionRateError):
            pension.calculate(basic_salary=200000.0, employee_rate=0.05)

    def test_invalid_employer_rate(self):
        with pytest.raises(errors.InvalidPensionRateError):
            pension.calculate(basic_salary=200000.0, employer_rate=0.05)

    def test_custom_rates(self):
        result = pension.calculate(
            basic_salary=200000.0,
            employee_rate=0.10,
            employer_rate=0.15,
            salary_payment_date="2026-01-05",
        )
        assert result["employee_contribution"] == bankers_round(200000.0 * 0.10)
        assert result["employer_contribution"] == bankers_round(200000.0 * 0.15)


class TestStatutory:
    def test_nhf(self):
        result = statutory.nhf(basic_salary=200000.0)
        assert result["nhf_amount"] == bankers_round(200000.0 * 0.025)
        assert result["rate"] == 0.025

    def test_nsitf(self):
        result = statutory.nsitf(monthly_payroll=1000000.0)
        assert result["nsitf_amount"] == bankers_round(1000000.0 * 0.01)
        assert result["contributor_type"] == "employer"

    def test_itf_eligible(self):
        result = statutory.itf(
            annual_payroll=12000000.0,
            employee_count=10,
        )
        assert result["eligible"] is True
        assert result["itf_amount"] == bankers_round(12000000.0 * 0.01)

    def test_itf_not_eligible(self):
        result = statutory.itf(
            annual_payroll=12000000.0,
            employee_count=3,
            annual_turnover=10000000.0,
        )
        assert result["eligible"] is False
        assert result["itf_amount"] == 0.0

    def test_calculate_all(self):
        result = statutory.calculate_all(
            basic_salary=200000.0,
            monthly_payroll=1000000.0,
            annual_payroll=12000000.0,
            employee_count=10,
        )
        assert "nhf" in result
        assert "nsitf" in result
        assert "itf" in result


class TestMarketplace:
    def test_vat_registered_seller(self):
        result = marketplace.calculate_transaction(
            sale_amount=100000.0,
            platform_commission=0.10,
            seller_vat_registered=True,
            payment_date="2026-01-15",
        )
        assert result["wht"] is None
        assert result["vat"]["vat"] == 7500.0
        assert result["total_from_buyer"] == 107500.0
        # Balance invariant
        assert bankers_round(
            result["seller_payout"]
            + result["platform_commission"]["amount"]
            + result["vat"]["vat"]
        ) == result["total_from_buyer"]

    def test_unregistered_seller(self):
        result = marketplace.calculate_transaction(
            sale_amount=100000.0,
            platform_commission=0.10,
            seller_vat_registered=False,
            payment_date="2026-01-15",
        )
        assert result["wht"] is not None
        assert result["wht"]["wht_amount"] > 0


class TestPayroll:
    def test_empty_batch(self):
        result = payroll.calculate_batch([])
        assert result["employees"] == []
        assert result["by_state"] == {}
        assert result["totals"]["employee_count"] == 0

    def test_single_employee(self):
        result = payroll.calculate_batch([
            {
                "name": "Test Employee",
                "gross_annual": 5000000.0,
                "state_of_residence": "LA",
            }
        ])
        assert len(result["employees"]) == 1
        assert result["totals"]["employee_count"] == 1
        assert "LA" in result["by_state"]
        assert result["by_state"]["LA"]["state_name"] == "Lagos"

    def test_invalid_state(self):
        with pytest.raises(errors.InvalidStateError):
            payroll.calculate_batch([
                {
                    "name": "Test",
                    "gross_annual": 5000000.0,
                    "state_of_residence": "XX",
                }
            ])
