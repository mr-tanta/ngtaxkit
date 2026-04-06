"""Cross-language parity tests — Python must match TypeScript for identical fixture inputs.

Validates: Requirements 12.1, 12.2, 12.3
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from ngtaxkit import marketplace, paye, payroll, pension, statutory, vat, wht
from ngtaxkit.errors import (
    InvalidAmountError,
    InvalidCategoryError,
    InvalidPensionRateError,
    InvalidServiceTypeError,
    InvalidStateError,
)

# ─── Fixture Loading ─────────────────────────────────────────────────────────

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures"


def _load_fixture(name: str) -> list[dict]:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


# ─── VAT Parity Tests ────────────────────────────────────────────────────────

VAT_FIXTURES = _load_fixture("vat_test_cases.json")


class TestVatParity:
    @pytest.mark.parametrize(
        "tc", [tc for tc in VAT_FIXTURES if "expected" in tc], ids=lambda tc: tc["description"]
    )
    def test_vat_expected(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]
        result = vat.calculate(
            amount=inp["amount"],
            inclusive=inp.get("inclusive", False),
            category=inp.get("category", "standard"),
            date=inp.get("date"),
        )
        assert result["net"] == exp["net"]
        assert result["vat"] == exp["vat"]
        assert result["gross"] == exp["gross"]
        assert result["rate"] == exp["rate"]
        assert result["rate_type"] == exp["rateType"]
        assert result["category"] == exp["category"]
        assert result["input_vat_recoverable"] == exp["inputVatRecoverable"]

    @pytest.mark.parametrize(
        "tc",
        [tc for tc in VAT_FIXTURES if "expectedError" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_vat_errors(self, tc: dict) -> None:
        inp = tc["input"]
        code = tc["expectedError"]["code"]
        err_cls = {
            "NGTK_INVALID_AMOUNT": InvalidAmountError,
            "NGTK_INVALID_CATEGORY": InvalidCategoryError,
        }[code]
        with pytest.raises(err_cls):
            vat.calculate(
                amount=inp["amount"],
                category=inp.get("category", "standard"),
            )


# ─── PAYE Parity Tests ───────────────────────────────────────────────────────

PAYE_FIXTURES = _load_fixture("paye_test_cases.json")


class TestPayeParity:
    @pytest.mark.parametrize("tc", PAYE_FIXTURES, ids=lambda tc: tc["description"])
    def test_paye(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]
        result = paye.calculate(
            gross_annual=inp["grossAnnual"],
            pension_contributing=inp.get("pensionContributing", False),
            nhf_contributing=inp.get("nhfContributing", False),
            rent_paid_annual=inp.get("rentPaidAnnual", 0.0),
        )
        assert result["gross_annual"] == exp["grossAnnual"]
        assert result["exempt"] == exp["exempt"]
        assert result["annual_paye"] == exp["annualPaye"]
        assert result["monthly_paye"] == exp["monthlyPaye"]
        assert result["effective_rate"] == exp["effectiveRate"]

        if "grossMonthly" in exp:
            assert result["gross_monthly"] == exp["grossMonthly"]

        if "reliefs" in exp:
            r = exp["reliefs"]
            assert result["reliefs"]["consolidated_relief"] == r["consolidatedRelief"]
            assert result["reliefs"]["pension_relief"] == r["pensionRelief"]
            assert result["reliefs"]["nhf_relief"] == r["nhfRelief"]
            assert result["reliefs"]["rent_relief"] == r["rentRelief"]
            assert result["reliefs"]["total"] == r["total"]

        if "taxableIncome" in exp:
            assert result["taxable_income"] == exp["taxableIncome"]

        if "taxBands" in exp:
            for i, band in enumerate(exp["taxBands"]):
                assert result["tax_bands"][i]["tax_in_band"] == band["taxInBand"]


# ─── WHT Parity Tests ────────────────────────────────────────────────────────

WHT_FIXTURES = _load_fixture("wht_test_cases.json")


class TestWhtParity:
    @pytest.mark.parametrize(
        "tc", [tc for tc in WHT_FIXTURES if "expected" in tc], ids=lambda tc: tc["description"]
    )
    def test_wht_expected(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]
        result = wht.calculate(
            amount=inp["amount"],
            payee_type=inp["payeeType"],
            service_type=inp["serviceType"],
            payee_is_small_company=inp.get("payeeIsSmallCompany", False),
            payment_date=inp.get("paymentDate"),
        )
        assert result["gross_amount"] == exp["grossAmount"]
        assert result["rate"] == exp["rate"]
        assert result["wht_amount"] == exp["whtAmount"]
        assert result["net_payment"] == exp["netPayment"]
        assert result["exempt"] == exp["exempt"]
        assert result["credit_note_required"] == exp["creditNoteRequired"]
        assert result["remittance_deadline"] == exp["remittanceDeadline"]

        if "exemptionBasis" in exp:
            assert result["exemption_basis"] == exp["exemptionBasis"]

    @pytest.mark.parametrize(
        "tc",
        [tc for tc in WHT_FIXTURES if "expectedError" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_wht_errors(self, tc: dict) -> None:
        inp = tc["input"]
        with pytest.raises(InvalidServiceTypeError):
            wht.calculate(
                amount=inp["amount"],
                payee_type=inp["payeeType"],
                service_type=inp["serviceType"],
                payment_date=inp.get("paymentDate"),
            )


# ─── Pension Parity Tests ────────────────────────────────────────────────────

PENSION_FIXTURES = _load_fixture("pension_test_cases.json")


class TestPensionParity:
    @pytest.mark.parametrize(
        "tc",
        [tc for tc in PENSION_FIXTURES if "expected" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_pension_expected(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]
        result = pension.calculate(
            basic_salary=inp["basicSalary"],
            housing_allowance=inp.get("housingAllowance", 0.0),
            transport_allowance=inp.get("transportAllowance", 0.0),
            employee_rate=inp.get("employeeRate"),
            employer_rate=inp.get("employerRate"),
            salary_payment_date=inp.get("salaryPaymentDate"),
        )
        assert result["pensionable_earnings"] == exp["pensionableEarnings"]
        assert result["employee_contribution"] == exp["employeeContribution"]
        assert result["employer_contribution"] == exp["employerContribution"]
        assert result["total_contribution"] == exp["totalContribution"]

        if "remittanceDeadline" in exp:
            assert result["remittance_deadline"] == exp["remittanceDeadline"]

    @pytest.mark.parametrize(
        "tc",
        [tc for tc in PENSION_FIXTURES if "expectedError" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_pension_errors(self, tc: dict) -> None:
        inp = tc["input"]
        with pytest.raises(InvalidPensionRateError):
            pension.calculate(
                basic_salary=inp["basicSalary"],
                housing_allowance=inp.get("housingAllowance", 0.0),
                transport_allowance=inp.get("transportAllowance", 0.0),
                employee_rate=inp.get("employeeRate"),
                employer_rate=inp.get("employerRate"),
            )


# ─── Statutory Parity Tests ──────────────────────────────────────────────────

STATUTORY_FIXTURES = _load_fixture("statutory_test_cases.json")


class TestStatutoryParity:
    @pytest.mark.parametrize(
        "tc", STATUTORY_FIXTURES, ids=lambda tc: tc["description"]
    )
    def test_statutory(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]
        fn = inp["function"]

        if fn == "nhf":
            result = statutory.nhf(basic_salary=inp["basicSalary"])
            assert result["nhf_amount"] == exp["nhfAmount"]
            assert result["rate"] == exp["rate"]
            assert result["base"] == exp["base"]

        elif fn == "nsitf":
            result = statutory.nsitf(monthly_payroll=inp["monthlyPayroll"])
            assert result["nsitf_amount"] == exp["nsitfAmount"]
            assert result["rate"] == exp["rate"]
            assert result["base"] == exp["base"]
            assert result["contributor_type"] == exp["contributorType"]

        elif fn == "itf":
            result = statutory.itf(
                annual_payroll=inp["annualPayroll"],
                employee_count=inp["employeeCount"],
                annual_turnover=inp.get("annualTurnover", 0.0),
                training_spend=inp.get("trainingSpend", 0.0),
            )
            assert result["itf_amount"] == exp["itfAmount"]
            assert result["rate"] == exp["rate"]
            assert result["eligible"] == exp["eligible"]
            assert result["refund_amount"] == exp["refundAmount"]
            if "eligibilityBasis" in exp:
                assert result["eligibility_basis"] == exp["eligibilityBasis"]

        elif fn == "calculateAll":
            result = statutory.calculate_all(
                basic_salary=inp["basicSalary"],
                monthly_payroll=inp["monthlyPayroll"],
                annual_payroll=inp["annualPayroll"],
                employee_count=inp["employeeCount"],
                annual_turnover=inp.get("annualTurnover", 0.0),
            )
            assert result["nhf"]["nhf_amount"] == exp["nhf"]["nhfAmount"]
            assert result["nhf"]["rate"] == exp["nhf"]["rate"]
            assert result["nsitf"]["nsitf_amount"] == exp["nsitf"]["nsitfAmount"]
            assert result["nsitf"]["rate"] == exp["nsitf"]["rate"]
            assert result["itf"]["itf_amount"] == exp["itf"]["itfAmount"]
            assert result["itf"]["rate"] == exp["itf"]["rate"]
            assert result["itf"]["eligible"] == exp["itf"]["eligible"]


# ─── Marketplace Parity Tests ────────────────────────────────────────────────

MARKETPLACE_FIXTURES = _load_fixture("marketplace_test_cases.json")


class TestMarketplaceParity:
    @pytest.mark.parametrize("tc", MARKETPLACE_FIXTURES, ids=lambda tc: tc["description"])
    def test_marketplace(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]
        result = marketplace.calculate_transaction(
            sale_amount=inp["saleAmount"],
            platform_commission=inp["platformCommission"],
            seller_vat_registered=inp["sellerVatRegistered"],
            buyer_type=inp.get("buyerType", "individual"),
            service_category=inp.get("serviceCategory", "standard"),
            platform_is_vat_agent=inp.get("platformIsVatAgent", False),
            payment_date=inp.get("paymentDate"),
        )

        assert result["sale_amount"] == exp["saleAmount"]
        assert result["vat"]["net"] == exp["vat"]["net"]
        assert result["vat"]["vat"] == exp["vat"]["vat"]
        assert result["vat"]["gross"] == exp["vat"]["gross"]
        assert result["vat"]["rate"] == exp["vat"]["rate"]
        assert result["vat"]["rate_type"] == exp["vat"]["rateType"]
        assert result["total_from_buyer"] == exp["totalFromBuyer"]
        assert result["platform_commission"]["rate"] == exp["platformCommission"]["rate"]
        assert result["platform_commission"]["amount"] == exp["platformCommission"]["amount"]
        assert result["seller_payout"] == exp["sellerPayout"]

        if exp["wht"] is None:
            assert result["wht"] is None
        else:
            assert result["wht"] is not None
            assert result["wht"]["gross_amount"] == exp["wht"]["grossAmount"]
            assert result["wht"]["rate"] == exp["wht"]["rate"]
            assert result["wht"]["wht_amount"] == exp["wht"]["whtAmount"]
            assert result["wht"]["credit_note_required"] == exp["wht"]["creditNoteRequired"]

        assert result["vat_liability"]["amount"] == exp["vatLiability"]["vatAmount"]
        assert result["vat_liability"]["collected_by"] == exp["vatLiability"]["collectedBy"]

        # Balance invariant
        wht_amt = result["wht"]["wht_amount"] if result["wht"] else 0
        from ngtaxkit.utils import bankers_round
        assert result["total_from_buyer"] == bankers_round(
            result["seller_payout"]
            + result["platform_commission"]["amount"]
            + result["vat"]["vat"]
            + wht_amt
        )


# ─── Payroll Parity Tests ────────────────────────────────────────────────────

PAYROLL_FIXTURES = _load_fixture("payroll_test_cases.json")


class TestPayrollParity:
    @pytest.mark.parametrize(
        "tc",
        [tc for tc in PAYROLL_FIXTURES if "expected" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_payroll_expected(self, tc: dict) -> None:
        inp = tc["input"]
        exp = tc["expected"]

        # Map camelCase fixture keys to snake_case Python keys
        employees = []
        for emp in inp["employees"]:
            employees.append({
                "id": emp.get("id"),
                "name": emp["name"],
                "gross_annual": emp["grossAnnual"],
                "state_of_residence": emp["stateOfResidence"],
                "pension_contributing": emp.get("pensionContributing", False),
                "nhf_contributing": emp.get("nhfContributing", False),
            })

        result = payroll.calculate_batch(employees)

        assert result["totals"]["employee_count"] == exp["employeeCount"]

        if "totals" in exp:
            assert result["totals"]["total_gross"] == exp["totals"]["totalGross"]
            assert result["totals"]["employee_count"] == exp["totals"]["employeeCount"]
            if "totalPaye" in exp["totals"]:
                assert result["totals"]["total_paye"] == exp["totals"]["totalPaye"]

        if "byState" in exp:
            for state_code, state_exp in exp["byState"].items():
                assert state_code in result["by_state"]
                state_result = result["by_state"][state_code]
                assert state_result["state_code"] == state_exp["stateCode"]
                assert state_result["state_name"] == state_exp["stateName"]
                assert state_result["irs_name"] == state_exp["irsName"]
                assert state_result["employee_count"] == state_exp["employeeCount"]
                assert state_result["filing_methods"] == state_exp["filingMethods"]
                assert state_result["portal_url"] == state_exp["portalUrl"]
                assert state_result["form_h1_deadline"] == state_exp["formH1Deadline"]

                if "totalPaye" in state_exp:
                    assert state_result["total_paye"] == state_exp["totalPaye"]

        if "employees" in exp:
            for i, emp_exp in enumerate(exp["employees"]):
                emp_result = result["employees"][i]
                assert emp_result["gross_annual"] == emp_exp["grossAnnual"]
                if "annualPaye" in emp_exp:
                    assert emp_result["annual_paye"] == emp_exp["annualPaye"]
                if "monthlyPaye" in emp_exp:
                    assert emp_result["monthly_paye"] == emp_exp["monthlyPaye"]
                if "exempt" in emp_exp:
                    assert emp_result["exempt"] == emp_exp["exempt"]

    @pytest.mark.parametrize(
        "tc",
        [tc for tc in PAYROLL_FIXTURES if "expectedError" in tc],
        ids=lambda tc: tc["description"],
    )
    def test_payroll_errors(self, tc: dict) -> None:
        inp = tc["input"]
        employees = []
        for emp in inp["employees"]:
            employees.append({
                "id": emp.get("id"),
                "name": emp["name"],
                "gross_annual": emp["grossAnnual"],
                "state_of_residence": emp.get("stateOfResidence", "XX"),
            })
        with pytest.raises(InvalidStateError):
            payroll.calculate_batch(employees)
