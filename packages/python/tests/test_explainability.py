"""Explainability tests for source-backed rates and calculations."""

from __future__ import annotations

import pytest

from ngtaxkit import errors, paye, rates, vat, wht


class TestRateExplainability:
    def test_explain_returns_source_metadata_for_exact_rate_key(self) -> None:
        source = rates.explain("vat.standard.rate")

        assert source["key"] == "vat.standard.rate"
        assert source["value"] == 0.075
        assert "Nigeria Tax Act" in source["source_title"]
        assert source["source_type"] == "official_act"
        assert source["verification_status"] == "verified"
        assert source["confidence"] == "high"

    def test_explain_falls_back_to_nearest_source_backed_prefix(self) -> None:
        source = rates.explain("wht.serviceTypes.professional.individual")

        assert source["key"] == "wht.serviceTypes.professional.individual"
        assert source["value"] == 0.05
        assert "Deduction of Tax at Source" in source["source_title"]
        assert "professional services" in source["legal_basis"]

    def test_explain_raises_for_unknown_rate_key(self) -> None:
        with pytest.raises(errors.RateNotFoundError):
            rates.explain("vat.nope.rate")

    def test_explain_marks_custom_overrides_as_needs_review_without_custom_source(self) -> None:
        rates.set_custom({"vat.standard.rate": 0.10})

        try:
            source = rates.explain("vat.standard.rate")
        finally:
            rates.clear_custom()

        assert source["key"] == "vat.standard.rate"
        assert source["value"] == 0.10
        assert source["overridden"] is True
        assert source["verification_status"] == "needs_review"
        assert source["confidence"] == "low"
        assert source["source_title"] == "Process-local custom override"
        assert any("no custom source metadata" in warning for warning in source["warnings"])

    def test_explain_uses_custom_source_metadata_for_custom_overrides(self) -> None:
        rates.set_custom({"vat.standard.rate": 0.10})
        rates.set_custom_sources({
            "vat.standard.rate": {
                "source_title": "Internal tax desk memo",
                "source_url": "https://example.com/internal-tax-memo",
                "source_type": "secondary_reference",
                "legal_basis": "Internal test-only override approved for sandbox calculations",
                "effective_date": "2026-05-16",
                "last_reviewed": "2026-05-16",
                "verification_status": "verified",
                "confidence": "medium",
                "notes": "Used by tests to prove custom override source propagation.",
            },
        })

        try:
            source = rates.explain("vat.standard.rate")
        finally:
            rates.clear_custom()

        assert source["value"] == 0.10
        assert source["overridden"] is True
        assert source["source_title"] == "Internal tax desk memo"
        assert source["verification_status"] == "verified"
        assert source["warnings"] == []

    def test_audit_summarizes_source_metadata_coverage(self) -> None:
        audit = rates.audit()

        assert audit["version"] == rates.get_version()
        assert audit["total_keys"] > 0
        assert audit["verified"] > 0
        assert "vat.standard.rate" not in audit["missing_metadata"]
        assert any(source["key"] == "vat.standard.rate" for source in audit["sources"])


class TestCalculationExplainability:
    def test_vat_explain_calculate_returns_result_formula_and_sources(self) -> None:
        explanation = vat.explain_calculate(amount=10_000.0, category="standard")

        assert explanation["result"] == vat.calculate(amount=10_000.0, category="standard")
        assert explanation["inputs"] == {
            "amount": 10_000.0,
            "inclusive": False,
            "category": "standard",
            "date": None,
        }
        assert any("VAT = net amount * rate" in step for step in explanation["formula"])
        assert "vat.standard.rate" in explanation["rate_keys"]
        assert any(source["key"] == "vat.standard.rate" for source in explanation["sources"])
        assert explanation["warnings"] == []

    def test_vat_explain_calculate_handles_zero_rated_categories(self) -> None:
        explanation = vat.explain_calculate(amount=5_000.0, category="medicine")

        assert explanation["result"]["vat"] == 0.0
        assert "vat.zeroRated.medicine.rate" in explanation["rate_keys"]
        assert any(
            source["key"] == "vat.zeroRated.medicine.rate"
            for source in explanation["sources"]
        )
        assert any("input VAT recoverable" in assumption for assumption in explanation["assumptions"])

    def test_paye_explain_calculate_returns_formula_sources_and_warnings(self) -> None:
        explanation = paye.explain_calculate(
            gross_annual=5_000_000.0,
            pension_contributing=True,
            nhf_contributing=True,
            rent_paid_annual=1_200_000.0,
        )

        assert explanation["result"] == paye.calculate(
            gross_annual=5_000_000.0,
            pension_contributing=True,
            nhf_contributing=True,
            rent_paid_annual=1_200_000.0,
        )
        assert any(
            "Taxable income = gross annual income - total reliefs" in step
            for step in explanation["formula"]
        )
        assert {
            "paye.exemptionThreshold",
            "paye.cra.fixedAmount",
            "paye.cra.percentOfGross",
            "paye.cra.additionalPercentOfGross",
            "paye.rentRelief.rate",
            "paye.rentRelief.cap",
            "paye.bands",
            "pension.minimumRates.employee",
            "pension.minimumRates.employer",
            "statutory.nhf.rate",
        }.issubset(set(explanation["rate_keys"]))
        assert any(source["key"] == "paye.bands" for source in explanation["sources"])
        assert any("statutory.nhf.rate" in warning for warning in explanation["warnings"])

    def test_paye_explain_calculate_explains_exemption_threshold(self) -> None:
        explanation = paye.explain_calculate(gross_annual=800_000.0)

        assert explanation["result"]["exempt"] is True
        assert "paye.exemptionThreshold" in explanation["rate_keys"]
        assert any(
            "Gross annual income is at or below the exemption threshold" in step
            for step in explanation["formula"]
        )

    def test_wht_explain_calculate_returns_formula_and_sources(self) -> None:
        explanation = wht.explain_calculate(
            amount=1_000_000.0,
            payee_type="company",
            service_type="professional",
            payment_date="2026-06-15",
        )

        assert explanation["result"] == wht.calculate(
            amount=1_000_000.0,
            payee_type="company",
            service_type="professional",
            payment_date="2026-06-15",
        )
        assert any(
            "WHT amount = gross amount * withholding rate" in step
            for step in explanation["formula"]
        )
        assert {
            "wht.serviceTypes.professional.company",
            "wht.remittanceDeadline.dayOfMonth",
        }.issubset(set(explanation["rate_keys"]))
        assert any(
            source["key"] == "wht.serviceTypes.professional.company"
            for source in explanation["sources"]
        )

    def test_wht_explain_calculate_explains_small_company_exemption(self) -> None:
        explanation = wht.explain_calculate(
            amount=2_000_000.0,
            payee_type="company",
            service_type="professional",
            payee_is_small_company=True,
            payment_date="2026-06-15",
        )

        assert explanation["result"]["exempt"] is True
        assert "wht.smallCompanyExemption.threshold" in explanation["rate_keys"]
        assert any("Small company exemption applies" in step for step in explanation["formula"])
        assert any(
            "wht.smallCompanyExemption.threshold" in warning
            for warning in explanation["warnings"]
        )
