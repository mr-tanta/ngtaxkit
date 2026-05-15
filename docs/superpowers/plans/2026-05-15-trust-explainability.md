# Trust + Explainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add source-backed rate explanations, audit APIs, and VAT/PAYE/WHT calculation explanations to the TypeScript and Python products.

**Architecture:** Keep calculation behavior unchanged. Add a separate bundled source metadata registry that maps dot-path rate keys or prefixes to source records, then layer explanation APIs on top of existing calculators. Mirror the TypeScript source-of-truth behavior in Python and verify both installed artifacts.

**Tech Stack:** TypeScript, Vitest, Python typed dictionaries, pytest, mypy, Ruff, Turborepo, JSON rate files.

---

## File Structure

- Create `shared/rates/source_metadata_2026.json`: source metadata keyed by rate dot-path or prefix.
- Create `packages/core/src/explain.ts`: shared TypeScript explanation helpers and types if `rates/index.ts` becomes too large.
- Modify `packages/core/src/rates/index.ts`: load metadata, expose `explain()`, `audit()`, and helper source lookup.
- Modify `packages/core/src/types.ts`: export explainability types used by calculators.
- Modify `packages/core/src/vat.ts`, `packages/core/src/paye.ts`, `packages/core/src/wht.ts`: add `explainCalculate()`.
- Modify `packages/core/src/index.ts`: export new APIs and types.
- Modify `packages/core/src/rates/rates.test.ts`, `vat.test.ts`, `paye.test.ts`, `wht.test.ts`: TDD coverage.
- Copy `shared/rates/source_metadata_2026.json` to `packages/python/src/ngtaxkit/data/rates/source_metadata_2026.json`.
- Modify `packages/python/src/ngtaxkit/rates.py`: load metadata, expose `explain()`, `audit()`, and helper source lookup.
- Modify `packages/python/src/ngtaxkit/types.py`: add typed dictionaries for explainability.
- Modify `packages/python/src/ngtaxkit/vat.py`, `paye.py`, `wht.py`: add `explain_calculate()`.
- Modify `packages/python/tests/test_rates_packaging.py`, `test_smoke.py`, or new `test_explainability.py`: Python coverage.
- Modify `README.md`, `packages/typescript/README.md`, `packages/python/README.md`: add trust examples and disclaimer.
- Create `docs/trust.md`, `docs/rates.md`, `docs/tool-usage.md`.
- Modify `CHANGELOG.md`: add Unreleased notes for trust/explainability.

## Task 1: TypeScript Rate Source Metadata

**Files:**
- Create: `shared/rates/source_metadata_2026.json`
- Modify: `packages/core/src/rates/index.ts`
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/src/rates/rates.test.ts`

- [ ] **Step 1: Write failing tests for `rates.explain()` and `rates.audit()`**

Add tests to `packages/core/src/rates/rates.test.ts`:

```ts
describe('explain()', () => {
  it('returns source metadata for an exact rate key', () => {
    const source = explain('vat.standard.rate');
    expect(source.key).toBe('vat.standard.rate');
    expect(source.value).toBe(0.075);
    expect(source.sourceTitle).toContain('Nigeria Tax Act');
    expect(source.sourceType).toBe('official_act');
    expect(source.verificationStatus).toBe('verified');
    expect(source.confidence).toBe('high');
  });

  it('falls back to the nearest source-backed prefix', () => {
    const source = explain('wht.serviceTypes.professional.individual');
    expect(source.key).toBe('wht.serviceTypes.professional.individual');
    expect(source.value).toBe(0.05);
    expect(source.sourceTitle).toContain('Deduction of Tax at Source');
    expect(source.legalBasis).toContain('Professional services');
  });

  it('throws for unknown keys', () => {
    expect(() => explain('vat.nope.rate')).toThrow(RateNotFoundError);
  });
});

describe('audit()', () => {
  it('summarizes local source metadata coverage', () => {
    const result = audit();
    expect(result.version).toBe(getVersion());
    expect(result.totalKeys).toBeGreaterThan(0);
    expect(result.verified).toBeGreaterThan(0);
    expect(result.missingMetadata).not.toContain('vat.standard.rate');
    expect(result.sources.some((source) => source.key === 'vat.standard.rate')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/rates/rates.test.ts`

Expected: compile failure because `explain` and `audit` are not exported.

- [ ] **Step 3: Add TypeScript source types**

Add to `packages/core/src/types.ts`:

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
  value: import('./rates').RateValue;
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
  orphanedMetadata: string[];
  sources: RateSourceMetadata[];
}
```

- [ ] **Step 4: Add source metadata JSON**

Create `shared/rates/source_metadata_2026.json` with at least these exact/prefix entries:

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
      "notes": "Cross-checked against a government-hosted copy where available."
    },
    "vat.zeroRated": {
      "sourceTitle": "Nigeria Tax Act, 2025",
      "sourceUrl": "https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf",
      "sourceType": "official_act",
      "legalBasis": "Nigeria Tax Act 2025, First Schedule Part I - zero-rated supplies",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "high",
      "notes": "Applies to zero-rated VAT category entries under vat.zeroRated."
    },
    "vat.exempt": {
      "sourceTitle": "Nigeria Tax Act, 2025",
      "sourceUrl": "https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf",
      "sourceType": "official_act",
      "legalBasis": "Nigeria Tax Act 2025, First Schedule Part II - exempt supplies",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "high",
      "notes": "Applies to VAT-exempt category entries under vat.exempt."
    },
    "paye": {
      "sourceTitle": "Nigeria Tax Act, 2025",
      "sourceUrl": "https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf",
      "sourceType": "official_act",
      "legalBasis": "Nigeria Tax Act 2025 - personal income tax reliefs, exemption threshold, and graduated bands",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "high",
      "notes": "Covers PAYE relief and graduated-rate metadata in paye_brackets_2026.json."
    },
    "wht.serviceTypes": {
      "sourceTitle": "Deduction of Tax at Source (Withholding) Regulations, 2024",
      "sourceUrl": "https://assets.kpmg.com/content/dam/kpmg/ng/pdf/2024/10/Deduction%20of%20Tax%20at%20Source%20%28Withholding%29%20Regulations%202024_Gazetted.pdf",
      "sourceType": "professional_copy",
      "legalBasis": "Deduction of Tax at Source (Withholding) Regulations 2024, Schedule - withholding rates by transaction type",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "medium",
      "notes": "Gazetted copy located through professional-hosted PDF; prefer an official gazette URL if one becomes available."
    },
    "wht.serviceTypes.professional": {
      "sourceTitle": "Deduction of Tax at Source (Withholding) Regulations, 2024",
      "sourceUrl": "https://assets.kpmg.com/content/dam/kpmg/ng/pdf/2024/10/Deduction%20of%20Tax%20at%20Source%20%28Withholding%29%20Regulations%202024_Gazetted.pdf",
      "sourceType": "professional_copy",
      "legalBasis": "Deduction of Tax at Source (Withholding) Regulations 2024, Schedule - professional services",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "medium",
      "notes": "Covers individual and company professional-service WHT rates."
    },
    "wht.smallCompanyExemption": {
      "sourceTitle": "Nigeria Tax Act, 2025",
      "sourceUrl": "https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf",
      "sourceType": "official_act",
      "legalBasis": "Nigeria Tax Act 2025 - small company WHT exemption threshold",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "needs_review",
      "confidence": "medium",
      "notes": "Rate value should be rechecked against the final published Act before release."
    },
    "pension": {
      "sourceTitle": "Pension Reform Act 2014",
      "sourceUrl": "https://www.pencom.gov.ng/pra2014/",
      "sourceType": "regulator",
      "legalBasis": "Pension Reform Act 2014, section 4 - minimum employer and employee contributions",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "verified",
      "confidence": "high",
      "notes": "PenCom is the pension regulator and hosts the PRA 2014 reference page."
    },
    "statutory.nhf": {
      "sourceTitle": "National Housing Fund Act",
      "sourceUrl": "https://www.fmbn.gov.ng/",
      "sourceType": "regulator",
      "legalBasis": "National Housing Fund Act - employee contribution at 2.5% of basic salary",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "needs_review",
      "confidence": "medium",
      "notes": "Needs direct official statutory text URL before high confidence."
    },
    "statutory.nsitf": {
      "sourceTitle": "Employee Compensation Act 2010",
      "sourceUrl": "https://www.nsitf.gov.ng/",
      "sourceType": "regulator",
      "legalBasis": "Employee Compensation Act 2010 - employer contribution to NSITF",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "needs_review",
      "confidence": "medium",
      "notes": "Needs direct official statutory text URL before high confidence."
    },
    "statutory.itf": {
      "sourceTitle": "Industrial Training Fund Act",
      "sourceUrl": "https://www.itf.gov.ng/",
      "sourceType": "regulator",
      "legalBasis": "Industrial Training Fund Act - training contribution and refund rules",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "needs_review",
      "confidence": "medium",
      "notes": "Needs direct official statutory text URL before high confidence."
    },
    "state_filing": {
      "sourceTitle": "State Internal Revenue Service filing references",
      "sourceUrl": "https://www.jtb.gov.ng/",
      "sourceType": "government_portal",
      "legalBasis": "PAYE administration by state tax authorities",
      "effectiveDate": "2026-01-01",
      "lastReviewed": "2026-05-15",
      "verificationStatus": "needs_review",
      "confidence": "medium",
      "notes": "State contact and portal metadata should be reviewed per state before high confidence."
    }
  }
}
```

- [ ] **Step 5: Implement `explain()` and `audit()`**

In `packages/core/src/rates/index.ts`:

- Import `source_metadata_2026.json`.
- Add a `SourceRecord` type matching the JSON entries.
- Add `resolveMetadataKey(key)` that checks exact key, then parent prefixes from longest to shortest.
- Add `flattenRateKeys()` to walk registry leaves.
- Export `explain(key)` returning a `RateSourceMetadata` with the requested key and current `get(key)` value.
- Export `audit()` returning counts, missing metadata, orphaned metadata, and sorted sources.

- [ ] **Step 6: Export APIs**

Update `packages/core/src/index.ts` to re-export the new rate functions and types through the existing namespace export.

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/rates/rates.test.ts`

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add shared/rates/source_metadata_2026.json packages/core/src/rates/index.ts packages/core/src/types.ts packages/core/src/index.ts packages/core/src/rates/rates.test.ts
git commit -m "feat: add source-backed rate metadata"
```

## Task 2: TypeScript Calculation Explanations

**Files:**
- Modify: `packages/core/src/vat.ts`
- Modify: `packages/core/src/paye.ts`
- Modify: `packages/core/src/wht.ts`
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/src/vat.test.ts`
- Test: `packages/core/src/paye.test.ts`
- Test: `packages/core/src/wht.test.ts`

- [ ] **Step 1: Write failing tests for `explainCalculate()`**

Add VAT test:

```ts
it('explains VAT calculation with source metadata', () => {
  const explanation = vat.explainCalculate({ amount: 1_000 });
  expect(explanation.calculator).toBe('vat');
  expect(explanation.result.vat).toBe(75);
  expect(explanation.formula).toContain('amount * rate');
  expect(explanation.rateKeys).toContain('vat.standard.rate');
  expect(explanation.sources[0].sourceTitle).toContain('Nigeria Tax Act');
  expect(explanation.assumptions).toContain('category defaults to standard');
});
```

Add PAYE test:

```ts
it('explains PAYE calculation with rate keys and assumptions', () => {
  const explanation = paye.explainCalculate({ grossAnnual: 1_200_000 });
  expect(explanation.calculator).toBe('paye');
  expect(explanation.rateKeys).toContain('paye.exemptionThreshold');
  expect(explanation.rateKeys).toContain('paye.bands');
  expect(explanation.formula).toContain('taxable income');
  expect(explanation.sources.length).toBeGreaterThan(0);
});
```

Add WHT test:

```ts
it('explains WHT calculation with source metadata', () => {
  const explanation = wht.explainCalculate({
    amount: 50_000,
    payeeType: 'individual',
    serviceType: 'professional',
    paymentDate: '2026-05-15'
  });
  expect(explanation.calculator).toBe('wht');
  expect(explanation.result.whtAmount).toBe(2_500);
  expect(explanation.rateKeys).toContain('wht.serviceTypes.professional.individual');
  expect(explanation.formula).toContain('gross amount * WHT rate');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/vat.test.ts src/paye.test.ts src/wht.test.ts`

Expected: compile failures for missing `explainCalculate()`.

- [ ] **Step 3: Add `CalculationExplanation` type**

Add to `packages/core/src/types.ts`:

```ts
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

- [ ] **Step 4: Implement VAT explanation**

In `vat.ts`, import `rates` helpers or `explain` from rates and add:

```ts
export function explainCalculate(options: VatCalculateOptions): CalculationExplanation<VatCalculateOptions, VatResult> {
  const result = calculate(options);
  const category = options.category ?? 'standard';
  const rateKeys = category === 'standard'
    ? ['vat.standard.rate']
    : categoryIsZeroRated(category)
      ? [`vat.zeroRated.${category}`]
      : [`vat.exempt.${category}`];
  const sources = rateKeys.map((key) => rates.explain(key));
  return {
    calculator: 'vat',
    input: options,
    result,
    formula: options.inclusive
      ? 'inclusive VAT extraction: net = amount / (1 + rate); vat = gross - net'
      : 'exclusive VAT = amount * rate; gross = amount + VAT',
    rateKeys,
    sources,
    assumptions: [
      category === 'standard' ? 'category defaults to standard' : `category set to ${category}`,
      options.inclusive ? 'amount is VAT-inclusive' : 'amount is VAT-exclusive unless inclusive=true',
    ],
    warnings: sources.filter((source) => source.verificationStatus !== 'verified').map((source) => `${source.key} source status is ${source.verificationStatus}`),
  };
}
```

Use existing internal category helpers; if a helper is private and not suitable, add a small internal predicate.

- [ ] **Step 5: Implement PAYE explanation**

In `paye.ts`, add `explainCalculate()` using these rate keys:

```ts
const rateKeys = [
  'paye.exemptionThreshold',
  'paye.cra.fixedAmount',
  'paye.cra.percentOfGross',
  'paye.cra.additionalPercentOfGross',
  'paye.rentRelief.rate',
  'paye.rentRelief.cap',
  'paye.bands',
  'pension.minimumRates.employee',
  'pension.minimumRates.employer',
  'statutory.nhf.rate',
];
```

Return formula:

```ts
'taxable income = gross annual income - reliefs; annual PAYE = sum(taxable band amount * band rate)'
```

Return assumptions for `pensionContributing`, `nhfContributing`, and `rentPaidAnnual`.

- [ ] **Step 6: Implement WHT explanation**

In `wht.ts`, add `explainCalculate()` using rate keys:

```ts
const rateKeys = [
  `wht.serviceTypes.${options.serviceType}.${options.payeeType}`,
  'wht.smallCompanyExemption.threshold',
  'wht.remittanceDeadline.dayOfMonth',
];
```

Return formula:

```ts
'WHT amount = gross amount * WHT rate; net payment = gross amount - WHT amount'
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/vat.test.ts src/paye.test.ts src/wht.test.ts`

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/vat.ts packages/core/src/paye.ts packages/core/src/wht.ts packages/core/src/vat.test.ts packages/core/src/paye.test.ts packages/core/src/wht.test.ts
git commit -m "feat: explain core tax calculations"
```

## Task 3: Python Source Metadata and Explanation APIs

**Files:**
- Create: `packages/python/src/ngtaxkit/data/rates/source_metadata_2026.json`
- Modify: `packages/python/src/ngtaxkit/rates.py`
- Modify: `packages/python/src/ngtaxkit/types.py`
- Modify: `packages/python/tests/test_rates_packaging.py`
- Test: `packages/python/tests/test_explainability.py`

- [ ] **Step 1: Copy source metadata**

Copy `shared/rates/source_metadata_2026.json` to `packages/python/src/ngtaxkit/data/rates/source_metadata_2026.json`.

- [ ] **Step 2: Write failing Python tests**

Create `packages/python/tests/test_explainability.py`:

```python
import pytest

from ngtaxkit import rates, vat, paye, wht
from ngtaxkit.errors import RateNotFoundError


def test_rates_explain_returns_source_metadata() -> None:
    source = rates.explain("vat.standard.rate")
    assert source["key"] == "vat.standard.rate"
    assert source["value"] == 0.075
    assert "Nigeria Tax Act" in source["source_title"]
    assert source["source_type"] == "official_act"
    assert source["verification_status"] == "verified"


def test_rates_explain_uses_prefix_metadata() -> None:
    source = rates.explain("wht.serviceTypes.professional.individual")
    assert source["value"] == 0.05
    assert "Professional services" in source["legal_basis"]


def test_rates_explain_unknown_key_raises() -> None:
    with pytest.raises(RateNotFoundError):
        rates.explain("vat.nope.rate")


def test_rates_audit_summarizes_metadata() -> None:
    audit = rates.audit()
    assert audit["version"] == rates.get_version()
    assert audit["total_keys"] > 0
    assert audit["verified"] > 0
    assert "vat.standard.rate" not in audit["missing_metadata"]


def test_vat_explain_calculate() -> None:
    explanation = vat.explain_calculate(1000)
    assert explanation["calculator"] == "vat"
    assert explanation["result"]["vat"] == 75.0
    assert "vat.standard.rate" in explanation["rate_keys"]
```

Update `test_rates_packaging.py`:

```python
def test_source_metadata_is_packaged() -> None:
    data_path = resources.files("ngtaxkit").joinpath("data/rates/source_metadata_2026.json")
    assert data_path.is_file()
```

- [ ] **Step 3: Run tests and verify they fail**

Run: `python3 -m pytest tests/test_explainability.py tests/test_rates_packaging.py`

Expected: failures for missing metadata and explain APIs.

- [ ] **Step 4: Add Python types**

Add typed dictionaries in `packages/python/src/ngtaxkit/types.py` with snake_case fields:

```python
class RateSourceMetadata(TypedDict):
    key: str
    value: object
    source_title: str
    source_url: str
    source_type: str
    legal_basis: str
    effective_date: str
    last_reviewed: str
    verification_status: str
    confidence: str
    notes: str


class RateAuditResult(TypedDict):
    version: str
    effective_date: str
    last_reviewed: str
    total_keys: int
    verified: int
    needs_review: int
    disputed: int
    missing_metadata: list[str]
    orphaned_metadata: list[str]
    sources: list[RateSourceMetadata]
```

- [ ] **Step 5: Implement Python `rates.explain()` and `rates.audit()`**

In `rates.py`:

- Load `source_metadata_2026.json` from package data with repo fallback.
- Implement `_resolve_metadata_key(key: str) -> str | None`.
- Implement `_flatten_rate_keys() -> list[str]`.
- Implement `explain(key: str) -> RateSourceMetadata`.
- Implement `audit() -> RateAuditResult`.

Convert metadata keys from JSON camelCase to Python snake_case.

- [ ] **Step 6: Run Python rate tests**

Run: `python3 -m pytest tests/test_explainability.py tests/test_rates_packaging.py`

Expected: rate metadata tests pass; calculation explain tests still fail until Task 4 if not implemented here.

- [ ] **Step 7: Commit**

```bash
git add packages/python/src/ngtaxkit/data/rates/source_metadata_2026.json packages/python/src/ngtaxkit/rates.py packages/python/src/ngtaxkit/types.py packages/python/tests/test_rates_packaging.py packages/python/tests/test_explainability.py
git commit -m "feat: add python rate source metadata"
```

## Task 4: Python Calculation Explanations

**Files:**
- Modify: `packages/python/src/ngtaxkit/vat.py`
- Modify: `packages/python/src/ngtaxkit/paye.py`
- Modify: `packages/python/src/ngtaxkit/wht.py`
- Modify: `packages/python/src/ngtaxkit/types.py`
- Test: `packages/python/tests/test_explainability.py`

- [ ] **Step 1: Extend failing tests for calculation explanations**

Add tests:

```python
def test_paye_explain_calculate() -> None:
    explanation = paye.explain_calculate(1_200_000)
    assert explanation["calculator"] == "paye"
    assert "paye.exemptionThreshold" in explanation["rate_keys"]
    assert "taxable income" in explanation["formula"]
    assert explanation["sources"]


def test_wht_explain_calculate() -> None:
    explanation = wht.explain_calculate(
        50_000,
        payee_type="individual",
        service_type="professional",
        payment_date="2026-05-15",
    )
    assert explanation["calculator"] == "wht"
    assert explanation["result"]["wht_amount"] == 2500.0
    assert "wht.serviceTypes.professional.individual" in explanation["rate_keys"]
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `python3 -m pytest tests/test_explainability.py`

Expected: failures for missing `explain_calculate()`.

- [ ] **Step 3: Add `CalculationExplanation` typed dictionary**

Add to `types.py`:

```python
class CalculationExplanation(TypedDict):
    calculator: str
    input: dict[str, object]
    result: dict[str, object]
    formula: str
    rate_keys: list[str]
    sources: list[RateSourceMetadata]
    assumptions: list[str]
    warnings: list[str]
```

- [ ] **Step 4: Implement VAT/PAYE/WHT explainers**

Implement:

```python
def explain_calculate(...) -> CalculationExplanation:
    result = calculate(...)
    rate_keys = [...]
    sources = [rates.explain(key) for key in rate_keys]
    return {
        "calculator": "...",
        "input": {...},
        "result": result,
        "formula": "...",
        "rate_keys": rate_keys,
        "sources": sources,
        "assumptions": [...],
        "warnings": [
            f"{source['key']} source status is {source['verification_status']}"
            for source in sources
            if source["verification_status"] != "verified"
        ],
    }
```

- [ ] **Step 5: Run Python explainability tests**

Run: `python3 -m pytest tests/test_explainability.py tests/test_rates_packaging.py`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/python/src/ngtaxkit/types.py packages/python/src/ngtaxkit/vat.py packages/python/src/ngtaxkit/paye.py packages/python/src/ngtaxkit/wht.py packages/python/tests/test_explainability.py
git commit -m "feat: explain python tax calculations"
```

## Task 5: Documentation and Product Surface

**Files:**
- Create: `docs/trust.md`
- Create: `docs/rates.md`
- Create: `docs/tool-usage.md`
- Modify: `README.md`
- Modify: `packages/typescript/README.md`
- Modify: `packages/python/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write documentation**

Create `docs/trust.md` with:

```md
# Trust and Explainability

ngtaxkit is a deterministic calculation engine, not tax advice. It returns calculations and source-backed explanations so developers and tooling systems can show why a result was produced.

Use `rates.explain(key)` to inspect the source for a specific rate. Use `rates.audit()` before release to see which bundled rates are verified, need review, or are disputed.
```

Create `docs/rates.md` with:

```md
# Rates and Source Review

Rate files live in `shared/rates`. Source metadata lives in `shared/rates/source_metadata_2026.json`.

Every release that changes rates must update the source metadata, `lastReviewed`, and `CHANGELOG.md`.
```

Create `docs/tool-usage.md` with:

```md
# Tool Usage

tooling systems should call ngtaxkit for Nigerian tax math. They should not invent Nigerian tax rates.

Recommended pattern:

1. Call the calculator or explain API.
2. Present the result.
3. Present the legal basis and source metadata returned by ngtaxkit.
4. State that the output is a deterministic calculation, not tax advice.
```

- [ ] **Step 2: Update README examples**

Add TS example:

```ts
import { rates, vat } from 'ngtaxkit';

console.log(rates.explain('vat.standard.rate'));
console.log(vat.explainCalculate({ amount: 100_000 }));
```

Add Python example:

```python
from ngtaxkit import rates, vat

print(rates.explain("vat.standard.rate"))
print(vat.explain_calculate(100_000))
```

- [ ] **Step 3: Add changelog entry**

Add Unreleased bullets:

```md
- Add source-backed rate metadata and audit APIs
- Add VAT, PAYE, and WHT calculation explanations for TypeScript and Python
- Add trust, rates, and tool-usage documentation
```

- [ ] **Step 4: Commit**

```bash
git add docs/trust.md docs/rates.md docs/tool-usage.md README.md packages/typescript/README.md packages/python/README.md CHANGELOG.md
git commit -m "docs: add trust and explainability guidance"
```

## Task 6: Full Verification and Installed Package Smoke

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full local gates**

Run:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 2: Build and test npm tarball**

Run:

```bash
mkdir -p /private/tmp/ngtaxkit-explain-npm
cd packages/typescript
npm pack --pack-destination /private/tmp/ngtaxkit-explain-npm
cd /private/tmp/ngtaxkit-explain-npm
npm init -y
npm_config_cache=/private/tmp/ngtaxkit-explain-npm-cache npm install --offline --omit=optional --no-audit --no-fund --ignore-scripts --package-lock=false ./ngtaxkit-0.0.5.tgz
node --input-type=module -e "import { rates, vat } from 'ngtaxkit'; const source = rates.explain('vat.standard.rate'); const exp = vat.explainCalculate({ amount: 1000 }); console.log(JSON.stringify({ source: source.value, vat: exp.result.vat, sourceTitle: source.sourceTitle }));"
```

Expected output includes:

```json
{"source":0.075,"vat":75,"sourceTitle":"Nigeria Tax Act, 2025"}
```

- [ ] **Step 3: Build and test Python wheel**

Run:

```bash
cd packages/python
python3 -m build --wheel
python3 -m venv /private/tmp/ngtaxkit-explain-python
/private/tmp/ngtaxkit-explain-python/bin/python -m pip install --no-index --force-reinstall dist/ngtaxkit-0.0.5-py3-none-any.whl
/private/tmp/ngtaxkit-explain-python/bin/python -c "from ngtaxkit import rates, vat; source = rates.explain('vat.standard.rate'); exp = vat.explain_calculate(1000); print({'source': source['value'], 'vat': exp['result']['vat'], 'source_title': source['source_title']})"
```

Expected output includes:

```python
{'source': 0.075, 'vat': 75.0, 'source_title': 'Nigeria Tax Act, 2025'}
```

- [ ] **Step 4: Commit verification-only updates if any**

If package metadata or docs changed during verification, commit them. Otherwise do not create an empty commit.

## Self-Review Checklist

- Every spec requirement maps to a task.
- No task requires cloud code.
- Existing calculation outputs remain unchanged.
- tool schemas and release hardening are documented as follow-on milestones, not implemented in this plan.
- Tests are written before implementation for behavior changes.
