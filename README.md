# ngtaxkit

Nigerian tax compliance SDK for TypeScript and Python. Implements the Nigeria Tax Act (NTA) 2025 — VAT, PAYE, WHT, Pension, Statutory deductions, Marketplace transactions, and Payroll batch processing.

Zero dependencies. Pure functions. Deterministic output. Works anywhere — Node.js, Bun, Deno, browsers, Cloudflare Workers, Python 3.10+.

## Why

Every Nigerian business that collects or disburses money must calculate, collect, and remit taxes to the Nigeria Revenue Service (NRS). The NTA 2025 introduced restructured PAYE brackets, expanded zero-rated VAT categories, new input VAT recovery rules, mandatory e-invoicing via FIRSMBS, and harsher penalties for non-compliance.

Despite this, **zero open-source libraries exist** — in any language — for Nigerian tax calculation. ngtaxkit fills that gap.

## Install

```bash
# TypeScript / JavaScript
npm install @tantainnovative/ngtaxkit

# Python
pip install ngtaxkit
```

## Quick Start

### TypeScript

```typescript
import { vat, paye, wht } from '@tantainnovative/ngtaxkit';

// VAT calculation
const vatResult = vat.calculate({ amount: 100_000 });
// → { net: 100000, vat: 7500, gross: 107500, rate: 0.075, rateType: 'standard', ... }

// VAT extraction from inclusive amount
const extracted = vat.extract({ amount: 107_500 });
// → { net: 100000, vat: 7500, gross: 107500, ... }

// Zero-rated categories
const food = vat.calculate({ amount: 50_000, category: 'basic-food' });
// → { net: 50000, vat: 0, gross: 50000, rate: 0, rateType: 'zero-rated', ... }

// PAYE — annual salary
const payeResult = paye.calculate({
  grossAnnual: 5_000_000,
  pensionContributing: true,
  nhfContributing: true,
});
// → { annualPaye: ..., monthlyPaye: ..., effectiveRate: ..., taxBands: [...], ... }

// WHT — withholding tax on a professional service payment
const whtResult = wht.calculate({
  amount: 500_000,
  payeeType: 'company',
  serviceType: 'professional',
});
// → { whtAmount: 50000, rate: 0.1, netPayment: 450000, creditNoteRequired: true, ... }
```

### Python

```python
from ngtaxkit import vat, paye, wht

# VAT calculation
result = vat.calculate(amount=100_000)
# → {'net': 100000, 'vat': 7500, 'gross': 107500, 'rate': 0.075, 'rate_type': 'standard', ...}

# PAYE
result = paye.calculate(gross_annual=5_000_000, pension_contributing=True)

# WHT
result = wht.calculate(amount=500_000, payee_type='company', service_type='professional')
```

## Modules

| Module | Description |
|--------|-------------|
| `vat` | VAT calculation, extraction, category classification (standard / zero-rated / exempt) |
| `paye` | PAYE income tax with NTA 2025 graduated brackets, reliefs, and exemptions |
| `wht` | Withholding tax by service type, payee type, and small company exemption |
| `pension` | Contributory Pension Scheme (CPS) — employee/employer splits per PRA 2014 |
| `statutory` | NHF, NSITF, ITF statutory deductions |
| `marketplace` | End-to-end marketplace transaction: VAT + commission + WHT + seller payout |
| `payroll` | Batch payroll processing with per-state aggregation and filing info |
| `rates` | Versioned rate registry — all tax rates, brackets, and thresholds in one place |

## Document Generation (TypeScript)

The npm package includes NTA 2025-compliant document generators:

- **Invoice PDF** — with VAT line items, mandatory UBL fields, and Naira formatting
- **UBL 3.0 XML** — machine-readable invoice format for FIRSMBS e-invoicing
- **FIRS JSON / CSV** — export formats for tax filing
- **WHT Credit Note PDF** — withholding tax credit notes for payees
- **Form H1 PDF** — annual PAYE filing form per state
- **Payslip PDF** — employee payslip with all deduction breakdowns
- **VAT Return PDF** — monthly/quarterly VAT return document

```typescript
import { create, toPDF, toUBL, toFIRSJSON } from '@tantainnovative/ngtaxkit';

const invoice = create({
  seller: { name: 'Acme Ltd', tin: '12345678-0001', address: 'Lagos' },
  buyer: { name: 'Buyer Co', tin: '87654321-0001', address: 'Abuja' },
  items: [
    { description: 'Consulting services', quantity: 1, unitPrice: 500_000, category: 'standard' },
  ],
});

const pdf = toPDF(invoice);          // Buffer (requires pdfkit)
const xml = toUBL(invoice);          // UBL 3.0 XML string
const json = toFIRSJSON(invoice);    // FIRS-compatible JSON
```

## Key Design Decisions

- **Banker's rounding** — all monetary values use round-half-even to 2 decimal places, avoiding systematic rounding bias
- **Legal citations** — every calculation result includes a `legalBasis` string citing the specific NTA 2025 section, for audit readiness
- **Versioned rates** — tax rates, brackets, and thresholds are bundled as JSON and can be overridden at runtime via `rates.setCustom()` without upgrading the package
- **Cross-language parity** — TypeScript is the source of truth; Python produces identical results for identical inputs, enforced by shared JSON test fixtures in CI

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Test a single package
cd packages/core && npx vitest run
cd packages/python && pytest

# Lint
npm run lint

# Type check
npm run type-check
```

### Project Structure

```
├── packages/
│   ├── core/           # @ngtaxkit/core — calculation engine (source of truth)
│   ├── typescript/     # @tantainnovative/ngtaxkit — npm package (core + documents)
│   └── python/         # ngtaxkit — PyPI package (Python port)
├── shared/
│   ├── rates/          # Versioned JSON rate data (consumed by both languages)
│   └── fixtures/       # Cross-language parity test fixtures
├── package.json        # Turborepo workspace root
└── turbo.json
```

## Supported Tax Categories

### VAT Categories (NTA 2025)

| Category | Rate | Type |
|----------|------|------|
| `standard` | 7.5% | Standard rated |
| `basic-food` | 0% | Zero-rated |
| `medicine` | 0% | Zero-rated |
| `educational-books` | 0% | Zero-rated |
| `export-services` | 0% | Zero-rated |
| `residential-rent` | 0% | Exempt |
| `financial-services` | 0% | Exempt |
| ... | | [See full list in docs] |

### WHT Service Types

`professional` · `management` · `technical` · `consultancy` · `commission` · `construction` · `contract` · `rent` · `royalty` · `dividend` · `interest`

## License

MIT — see [LICENSE](LICENSE) for details.

## Author

**Abraham Tanta** ([@mr-tanta](https://github.com/mr-tanta))
