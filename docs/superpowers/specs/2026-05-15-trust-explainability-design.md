# Trust + Explainability Major Update Design

## Purpose

This milestone turns `ngtaxkit` from a deterministic calculator into a trusted, source-backed Nigerian tax SDK. The package should not only return a number; it should explain the rate used, the formula applied, the legal/source basis, the effective date, and any assumptions or warnings.

This is the first milestone of a larger major update:

- Milestone 1: Trust + Explainability
- Milestone 2: Tooling
- Milestone 3: Release Hardening

Milestone 1 is intentionally scoped so it can ship independently and improve both developer and tool integrations immediately.

## Goals

- Add source metadata for every rate domain and important rate key.
- Add explainability APIs in TypeScript and Python.
- Make calculation explanations machine-readable and human-readable.
- Make source confidence explicit with verification status and review dates.
- Preserve existing calculator behavior and public APIs.
- Add docs that position `ngtaxkit` as a calculation engine, not tax advice.

## Non-Goals

- Do not build the MCP/OpenAPI tool wrapper in this milestone.
- Do not build a cloud-backed rate sync system.
- Do not replace the current JSON rate registry.
- Do not perform automated legal interpretation beyond source-backed explanations.
- Do not claim professional tax advice or regulatory certification.

## Source Policy

Rate and legal metadata must be freshly reviewed during implementation. Source preference order:

1. Official Nigerian legislation, gazettes, regulator websites, or government-hosted PDFs.
2. Official regulator pages such as PenCom for pension law.
3. Professional copies of official gazettes when official hosting is hard to access.
4. Professional commentary only as secondary context, never as the primary source for a rate value.

Each source-backed entry must record:

- `sourceTitle`
- `sourceUrl`
- `sourceType`
- `legalBasis`
- `effectiveDate`
- `lastReviewed`
- `verificationStatus`
- `confidence`
- `notes`

Supported `sourceType` values:

- `official_act`
- `official_gazette`
- `regulator`
- `government_portal`
- `professional_copy`
- `secondary_reference`

Supported `verificationStatus` values:

- `verified`
- `needs_review`
- `disputed`

Supported `confidence` values:

- `high`
- `medium`
- `low`

Initial source candidates identified during design:

- Nigeria Tax Act 2025 PDF: `https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf`
- Nigeria Tax Act 2025 mirror: `https://irs.gm.gov.ng/docs/national/NIGERIA_TAX_ACT_2025.pdf`
- PenCom PRA 2014 page: `https://www.pencom.gov.ng/pra2014/`
- Gazetted Deduction of Tax at Source (Withholding) Regulations 2024 copy: `https://assets.kpmg.com/content/dam/kpmg/ng/pdf/2024/10/Deduction%20of%20Tax%20at%20Source%20%28Withholding%29%20Regulations%202024_Gazetted.pdf`
- PwC WHT gazette commentary: `https://www.pwc.com/ng/en/assets/pdf/deduction-of-tax-at-source-withholding-regulations-2024-key-changes-from-the-official-gazette.pdf`

## Data Model

Add a source metadata file under `shared/rates/source_metadata_2026.json`. Keeping metadata separate avoids destabilizing the existing rate files and lets the explainability layer map metadata to dot-path keys.

Example structure:

```json
{
  "version": "2026.1.0",
  "effectiveDate": "2026-01-01",
  "lastReviewed": "2026-05-15",
  "metadata": {
    "vat.standard.rate": {
      "sourceTitle": "Nigeria Tax Act, 2025",
      "sourceUrl": "https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf",
      "sourceType": "official_act",
      "legalBasis": "Nigeria Tax Act 2025, section 148 - VAT charged at 7.5% on taxable supplies",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "high",
      "notes": "Cross-check against the government-hosted mirror before release."
    }
  }
}
```

The source metadata must be copied into the Python package data during build, the same way rate JSON files are bundled now.

## TypeScript API

Add new exported types from `@ngtaxkit/core`:

```ts
export type SourceType =
  | 'official_act'
  | 'official_gazette'
  | 'regulator'
  | 'government_portal'
  | 'professional_copy'
  | 'secondary_reference';

export type VerificationStatus = 'verified' | 'needs_review' | 'disputed';
export type SourceConfidence = 'high' | 'medium' | 'low';

export interface RateSourceMetadata {
  key: string;
  value: RateValue;
  sourceTitle: string;
  sourceUrl: string;
  sourceType: SourceType;
  legalBasis: string;
  effectiveDate: string;
  lastReviewed: string;
  verificationStatus: VerificationStatus;
  confidence: SourceConfidence;
  notes: string;
}

export interface RateAuditResult {
  version: string;
  effectiveDate: string;
  lastReviewed: string;
  totalKeys: number;
  verified: number;
  needsReview: number;
  disputed: number;
  missingMetadata: string[];
  sources: RateSourceMetadata[];
}

export interface CalculationExplanation<TInput, TResult> {
  calculator: 'vat' | 'paye' | 'wht';
  input: TInput;
  result: TResult;
  formula: string;
  rateKeys: string[];
  sources: RateSourceMetadata[];
  assumptions: string[];
  warnings: string[];
}
```

Add APIs:

```ts
rates.explain(key: string): RateSourceMetadata
rates.audit(): RateAuditResult
vat.explainCalculate(options: VatCalculateOptions): CalculationExplanation<VatCalculateOptions, VatResult>
paye.explainCalculate(options: PayeCalculateOptions): CalculationExplanation<PayeCalculateOptions, PayeResult>
wht.explainCalculate(options: WhtCalculateOptions): CalculationExplanation<WhtCalculateOptions, WhtResult>
```

The existing `calculate()` functions remain unchanged. Explain functions call the existing calculation logic and attach metadata, formulas, assumptions, and warnings.

## Python API

Python mirrors the TypeScript behavior with snake_case names:

```python
rates.explain(key: str) -> RateSourceMetadata
rates.audit() -> RateAuditResult
vat.explain_calculate(...) -> CalculationExplanation
paye.explain_calculate(...) -> CalculationExplanation
wht.explain_calculate(...) -> CalculationExplanation
```

Python return values should be typed dictionaries to match the current package style. The top-level `ngtaxkit` package should expose these through the existing modules rather than adding a new dependency.

## Explanation Behavior

VAT explanation example:

- `formula`: `exclusive VAT = amount * rate`
- `rateKeys`: `["vat.standard.rate"]`
- `assumptions`: `["category defaults to standard", "amount is VAT-exclusive unless inclusive=true"]`
- `warnings`: empty unless metadata has `needs_review`, `disputed`, or missing source data.

PAYE explanation example:

- `formula`: `taxable income = gross annual income - reliefs; annual PAYE = sum(taxable band amount * band rate)`
- `rateKeys`: `["paye.exemptionThreshold", "paye.cra.fixedAmount", "paye.cra.percentOfGross", "paye.cra.additionalPercentOfGross", "paye.bands"]`
- `assumptions`: include pension/NHF/rent flags and default values.
- `warnings`: include any missing metadata for band-level entries.

WHT explanation example:

- `formula`: `WHT amount = gross amount * WHT rate`
- `rateKeys`: `["wht.serviceTypes.professional.individual"]`
- `assumptions`: include small company exemption handling and remittance deadline basis.
- `warnings`: include any `needs_review` source status.

## Audit Behavior

`rates.audit()` checks the loaded registry against source metadata and returns:

- Counts by verification status.
- Dot-path keys with no metadata.
- Metadata entries pointing to keys that no longer exist.
- Source summary for docs and release review.

The audit API must not perform network calls. It validates bundled local data only.

## Error Handling

- `rates.explain(key)` throws `RateNotFoundError` if the rate key does not exist.
- `rates.explain(key)` throws `RateNotFoundError` if metadata does not exist for the key.
- Explain-calculation functions should still throw the same validation errors as calculation functions.
- Explain-calculation functions should not hide calculation errors.
- Missing source data discovered during calculation explanations should be returned in `warnings` only when the calculation itself can still run.

## Documentation

Add docs under `docs/`:

- `docs/trust.md`: source policy, verification statuses, disclaimer, and how to read explanations.
- `docs/rates.md`: rate versioning, effective dates, source review workflow, and custom override warnings.
- `docs/tool-usage.md`: short guidance for tooling systems to use explain APIs and avoid inventing rates. This is a bridge to Milestone 2, not the full tool layer.

README updates:

- Add a "Trust and Explainability" section.
- Show `rates.explain("vat.standard.rate")`.
- Show `vat.explainCalculate(...)` or Python `vat.explain_calculate(...)`.
- Add disclaimer that `ngtaxkit` is a deterministic calculation engine and not tax advice.

## Testing

TypeScript:

- Add rate metadata fixture tests.
- Add `rates.explain()` tests for present and missing keys.
- Add `rates.audit()` tests for counts and missing metadata.
- Add `explainCalculate()` tests for VAT, PAYE, and WHT.
- Ensure existing calculator parity tests still pass.

Python:

- Add packaged metadata test confirming `source_metadata_2026.json` exists in the wheel.
- Add `rates.explain()` and `rates.audit()` tests.
- Add `explain_calculate()` tests for VAT, PAYE, and WHT.
- Ensure full Python test suite still passes from an installed wheel.

Installed-package smoke:

- npm tarball install should import `rates.explain` and `vat.explainCalculate`.
- Python wheel install should import `rates.explain` and `vat.explain_calculate`.

## Compatibility

This milestone is additive except for documentation. Existing calculation outputs remain unchanged. Custom overrides still work for `rates.get()`, but `rates.explain()` should mark overridden keys with a warning because process-local overrides do not have legal source metadata unless the user also supplies custom source metadata in a future version.

## Follow-On Milestone 2: Tooling

After explainability ships, add:

- JSON Schemas for calculator inputs and outputs.
- JSON Schemas for explanation outputs.
- Tool manifests for tool integrations.
- OpenAPI wrapper.
- MCP server or adapter.
- Prompt guidance: use `ngtaxkit` for math and source-backed explanations; never invent Nigerian tax rates.

## Follow-On Milestone 3: Release Hardening

After tool schemas, add:

- CI that builds npm tarball and Python wheel.
- CI that installs both artifacts in fresh temp projects.
- Package artifact checks for bundled rate and metadata files.
- Release checklist for rate-source review.
- Changelog sections for code changes, rate changes, source metadata changes, and verification status changes.

## Acceptance Criteria

- Every rate domain has source metadata.
- `rates.explain()` works in TypeScript and Python.
- `rates.audit()` works in TypeScript and Python.
- VAT, PAYE, and WHT have explanation APIs in TypeScript and Python.
- Docs clearly explain source trust, limitations, and non-advice status.
- npm tarball and Python wheel include source metadata.
- Full lint, type-check, test, build, npm installed-package smoke, and Python installed-wheel smoke pass.
