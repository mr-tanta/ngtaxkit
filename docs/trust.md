# Trust & Explainability

ngtaxkit is designed for products where tax results must be shown to users, stored for audit, or passed to automation tools without becoming a black box.

## What Is Bundled

- Versioned Nigerian tax rates, thresholds, brackets, and category data.
- Source metadata for bundled rate keys and prefixes.
- Calculation explanations for VAT, PAYE, and WHT.
- Audit coverage summaries through `rates.audit()` / `rates.audit()`.

## TypeScript

```typescript
import { rates, vat } from 'ngtaxkit';

const trace = vat.explainCalculate({ amount: 100_000, category: 'standard' });

trace.result;
trace.formula;
trace.rateKeys;
trace.sources;
trace.warnings;

rates.explain('vat.standard.rate');
rates.audit();
```

## Python

```python
from ngtaxkit import rates, vat

trace = vat.explain_calculate(amount=100_000, category="standard")

trace["result"]
trace["formula"]
trace["rate_keys"]
trace["sources"]
trace["warnings"]

rates.explain("vat.standard.rate")
rates.audit()
```

## Source Status

Each source record includes:

- `sourceTitle` / `source_title`
- `sourceUrl` / `source_url`
- `sourceType` / `source_type`
- `legalBasis` / `legal_basis`
- `lastReviewed` / `last_reviewed`
- `verificationStatus` / `verification_status`
- `confidence`
- `notes`

Warnings are emitted when a calculation depends on a source marked `needs_review` or `disputed`, or when source metadata is unavailable for a rate key.

## Operational Guidance

- Store the full explanation object when a result affects invoices, payroll, WHT credit notes, or user-visible filings.
- Show `formula`, `rateKeys`, and source titles in admin/debug views.
- Alert on non-empty `warnings` before using a result in a high-impact workflow.
- Re-check official notices before filing or advising users. ngtaxkit is developer infrastructure, not legal advice.
