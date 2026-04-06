# ngtaxkit

Nigerian tax compliance SDK for TypeScript and JavaScript. Implements the Nigeria Tax Act (NTA) 2025 — VAT, PAYE, WHT, Pension, Statutory deductions, Marketplace transactions, Payroll, and document generation.

Zero runtime dependencies for calculations. Pure functions. Deterministic output. Works in Node.js, Bun, Deno, browsers, and Cloudflare Workers.

[![npm version](https://img.shields.io/npm/v/ngtaxkit)](https://www.npmjs.com/package/ngtaxkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/mr-tanta/ngtaxkit/blob/main/LICENSE)

## Install

```bash
npm install ngtaxkit
```

## Quick Start

```typescript
import { vat, paye, wht, pension, payroll } from 'ngtaxkit';

// ─── VAT ────────────────────────────────────────────────────────────────────

// Calculate VAT on an amount
const result = vat.calculate({ amount: 100_000 });
// → { net: 100000, vat: 7500, gross: 107500, rate: 0.075, rateType: 'standard', ... }

// Extract VAT from an inclusive amount
const extracted = vat.extract({ amount: 107_500 });
// → { net: 100000, vat: 7500, gross: 107500, ... }

// Zero-rated categories (basic food, medicine, education, exports, etc.)
const food = vat.calculate({ amount: 50_000, category: 'basic-food' });
// → { vat: 0, rate: 0, rateType: 'zero-rated', inputVatRecoverable: true, ... }

// Exempt categories (residential rent, financial services, etc.)
const rent = vat.calculate({ amount: 200_000, category: 'residential-rent' });
// → { vat: 0, rate: 0, rateType: 'exempt', inputVatRecoverable: false, ... }

// ─── PAYE ───────────────────────────────────────────────────────────────────

const payeResult = paye.calculate({
  grossAnnual: 5_000_000,
  pensionContributing: true,
  nhfContributing: true,
  rentPaidAnnual: 600_000,
});
// → {
//     annualPaye: ...,
//     monthlyPaye: ...,
//     effectiveRate: ...,
//     taxBands: [...],       // graduated bracket breakdown
//     reliefs: { consolidatedRelief, pensionRelief, nhfRelief, rentRelief, total },
//     netMonthly: ...,
//     monthlyDeductions: { paye, pension, nhf, total },
//     employerCosts: { pension, nsitf, itf, total },
//     legalBasis: '...',     // NTA 2025 section reference
//   }

// ─── WHT ────────────────────────────────────────────────────────────────────

const whtResult = wht.calculate({
  amount: 500_000,
  payeeType: 'company',
  serviceType: 'professional',
});
// → {
//     whtAmount: 50000,
//     rate: 0.1,
//     netPayment: 450000,
//     creditNoteRequired: true,
//     remittanceDeadline: '2026-05-21',
//     legalBasis: '...',
//   }

// ─── Pension ────────────────────────────────────────────────────────────────

const pensionResult = pension.calculate({
  basicSalary: 300_000,
  housingAllowance: 100_000,
  transportAllowance: 50_000,
});
// → {
//     pensionableEarnings: 450000,
//     employeeContribution: 36000,  // 8% minimum
//     employerContribution: 45000,  // 10% minimum
//     totalContribution: 81000,
//   }

// ─── Payroll (batch) ────────────────────────────────────────────────────────

const batch = payroll.calculateBatch([
  { name: 'Amina', grossAnnual: 4_000_000, stateOfResidence: 'LA', pensionContributing: true },
  { name: 'Chidi', grossAnnual: 8_000_000, stateOfResidence: 'FC', pensionContributing: true },
  { name: 'Bola',  grossAnnual: 2_400_000, stateOfResidence: 'LA', nhfContributing: true },
]);
// → {
//     employees: [...],          // individual PAYE results per employee
//     byState: {
//       LA: { stateName: 'Lagos', irsName: 'LIRS', employeeCount: 2, totalPaye: ..., ... },
//       FC: { stateName: 'FCT', irsName: 'FCT-IRS', employeeCount: 1, ... },
//     },
//     totals: { totalGross, totalPaye, totalPension, totalNhf, employeeCount },
//   }
```

## Document Generation

Generate NTA 2025-compliant documents from calculation results:

```typescript
import { create, toPDF, toUBL, toFIRSJSON, toCSV } from 'ngtaxkit';

// Create a validated invoice
const invoice = create({
  seller: { name: 'Acme Ltd', tin: '12345678-0001', address: '123 Marina, Lagos' },
  buyer:  { name: 'Buyer Co', tin: '87654321-0001', address: '45 Wuse, Abuja' },
  items: [
    { description: 'Consulting services', quantity: 1, unitPrice: 500_000, category: 'standard' },
    { description: 'Training materials', quantity: 10, unitPrice: 5_000, category: 'educational-books' },
  ],
});

// Generate outputs
const pdf  = toPDF(invoice);        // Buffer (requires pdfkit as optional dep)
const xml  = toUBL(invoice);        // UBL 3.0 XML string (FIRSMBS e-invoicing)
const json = toFIRSJSON(invoice);   // FIRS-compatible JSON
const csv  = toCSV(invoice);        // CSV export
```

Other document generators:

```typescript
import { whtCreditNote, formH1, payslip, vatReturn } from 'ngtaxkit';

whtCreditNote.toPDF(whtResult);  // WHT credit note for payee
formH1.toPDF(payrollBatch);      // Annual PAYE filing form per state
payslip.toPDF(employeeResult);   // Employee payslip with all deductions
vatReturn.toPDF(vatData);        // Monthly/quarterly VAT return
```

## Modules

| Module | Description |
|--------|-------------|
| `vat` | VAT calculation, extraction, category classification |
| `paye` | PAYE income tax with NTA 2025 graduated brackets and reliefs |
| `wht` | Withholding tax by service type and payee type |
| `pension` | Contributory Pension Scheme — employee/employer splits |
| `statutory` | NHF, NSITF, ITF statutory deductions |
| `marketplace` | End-to-end marketplace transaction: VAT + commission + WHT + payout |
| `payroll` | Batch payroll with per-state aggregation and filing info |
| `rates` | Versioned rate registry — all rates, brackets, and thresholds |

## VAT Categories

| Category | Rate | Type | Input VAT Recoverable |
|----------|------|------|-----------------------|
| `standard` | 7.5% | Standard | Yes |
| `basic-food` | 0% | Zero-rated | Yes |
| `medicine` | 0% | Zero-rated | Yes |
| `medical-equipment` | 0% | Zero-rated | Yes |
| `medical-services` | 0% | Zero-rated | Yes |
| `educational-books` | 0% | Zero-rated | Yes |
| `tuition` | 0% | Zero-rated | Yes |
| `electricity` | 0% | Zero-rated | Yes |
| `export-services` | 0% | Zero-rated | Yes |
| `humanitarian-goods` | 0% | Zero-rated | Yes |
| `residential-rent` | 0% | Exempt | No |
| `public-transport` | 0% | Exempt | No |
| `financial-services` | 0% | Exempt | No |
| `insurance` | 0% | Exempt | No |

## WHT Service Types

| Service Type | Individual Rate | Company Rate |
|-------------|----------------|--------------|
| `professional` | 5% | 10% |
| `management` | 5% | 10% |
| `technical` | 5% | 10% |
| `consultancy` | 5% | 10% |
| `commission` | 5% | 10% |
| `construction` | 2.5% | 5% |
| `contract` | 5% | 10% |
| `rent` | 10% | 10% |
| `royalty` | 5% | 10% |
| `dividend` | 10% | 10% |
| `interest` | 10% | 10% |

## Key Design Decisions

- **Banker's rounding** — all monetary values use round-half-even to 2 decimal places
- **Legal citations** — every result includes a `legalBasis` string citing the specific NTA 2025 section
- **Versioned rates** — rates are bundled as JSON; override at runtime via `rates.setCustom()` without upgrading
- **Zero runtime dependencies** — calculation engine has no external dependencies
- **Dual format** — ships as both ESM and CommonJS with full TypeScript declarations

## Rate Overrides

```typescript
import { rates } from 'ngtaxkit';

// Override a specific rate
rates.setCustom({ 'vat.standard.rate': 0.10 });  // hypothetical 10% VAT

// Check current rate version
rates.getVersion();       // '2026.1'
rates.getEffectiveDate(); // '2026-01-01'

// Reset to bundled rates
rates.clearCustom();
```

## License

MIT — see [LICENSE](https://github.com/mr-tanta/ngtaxkit/blob/main/LICENSE)

## Author

**Abraham Tanta**

- [GitHub](https://github.com/mr-tanta)
- [LinkedIn](https://www.linkedin.com/in/mr-tanta/)
- [X](https://x.com/mr_tanta_a)

## Links

- [GitHub Repository](https://github.com/mr-tanta/ngtaxkit)
- [Changelog](https://github.com/mr-tanta/ngtaxkit/blob/main/CHANGELOG.md)
- [Python version](https://pypi.org/project/ngtaxkit/)
