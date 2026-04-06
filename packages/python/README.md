# ngtaxkit

Nigerian tax compliance SDK for Python. Implements the Nigeria Tax Act (NTA) 2025 — VAT, PAYE, WHT, Pension, Statutory deductions, Marketplace transactions, and Payroll batch processing.

Zero dependencies. Pure functions. Deterministic output. Python 3.10+.

[![PyPI version](https://img.shields.io/pypi/v/ngtaxkit)](https://pypi.org/project/ngtaxkit/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/mr-tanta/ngtaxkit/blob/main/LICENSE)

## Install

```bash
pip install ngtaxkit
```

Optional extras:

```bash
pip install ngtaxkit[pdf]    # PDF generation (fpdf2)
pip install ngtaxkit[cloud]  # Cloud API client (httpx)
```

## Quick Start

```python
from ngtaxkit import vat, paye, wht, pension, payroll

# ─── VAT ────────────────────────────────────────────────────────────────────

# Calculate VAT on an amount
result = vat.calculate(amount=100_000)
# → {'net': 100000, 'vat': 7500, 'gross': 107500, 'rate': 0.075, 'rate_type': 'standard', ...}

# Extract VAT from an inclusive amount
result = vat.extract(amount=107_500)
# → {'net': 100000, 'vat': 7500, 'gross': 107500, ...}

# Zero-rated categories
result = vat.calculate(amount=50_000, category='basic-food')
# → {'vat': 0, 'rate': 0, 'rate_type': 'zero-rated', 'input_vat_recoverable': True, ...}

# Exempt categories
result = vat.calculate(amount=200_000, category='residential-rent')
# → {'vat': 0, 'rate_type': 'exempt', 'input_vat_recoverable': False, ...}

# ─── PAYE ───────────────────────────────────────────────────────────────────

result = paye.calculate(
    gross_annual=5_000_000,
    pension_contributing=True,
    nhf_contributing=True,
    rent_paid_annual=600_000,
)
# → {
#     'annual_paye': ...,
#     'monthly_paye': ...,
#     'effective_rate': ...,
#     'tax_bands': [...],
#     'reliefs': {'consolidated_relief', 'pension_relief', 'nhf_relief', 'rent_relief', 'total'},
#     'net_monthly': ...,
#     'monthly_deductions': {'paye', 'pension', 'nhf', 'total'},
#     'employer_costs': {'pension', 'nsitf', 'itf', 'total'},
#     'legal_basis': '...',
#   }

# ─── WHT ────────────────────────────────────────────────────────────────────

result = wht.calculate(
    amount=500_000,
    payee_type='company',
    service_type='professional',
)
# → {
#     'wht_amount': 50000,
#     'rate': 0.1,
#     'net_payment': 450000,
#     'credit_note_required': True,
#     'remittance_deadline': '2026-05-21',
#   }

# ─── Pension ────────────────────────────────────────────────────────────────

result = pension.calculate(
    basic_salary=300_000,
    housing_allowance=100_000,
    transport_allowance=50_000,
)
# → {
#     'pensionable_earnings': 450000,
#     'employee_contribution': 36000,
#     'employer_contribution': 45000,
#     'total_contribution': 81000,
#   }

# ─── Payroll (batch) ────────────────────────────────────────────────────────

result = payroll.calculate_batch([
    {'name': 'Amina', 'gross_annual': 4_000_000, 'state_of_residence': 'LA', 'pension_contributing': True},
    {'name': 'Chidi', 'gross_annual': 8_000_000, 'state_of_residence': 'FC', 'pension_contributing': True},
    {'name': 'Bola',  'gross_annual': 2_400_000, 'state_of_residence': 'LA', 'nhf_contributing': True},
])
# → {
#     'employees': [...],
#     'by_state': {
#       'LA': {'state_name': 'Lagos', 'irs_name': 'LIRS', 'employee_count': 2, ...},
#       'FC': {'state_name': 'FCT', 'irs_name': 'FCT-IRS', 'employee_count': 1, ...},
#     },
#     'totals': {'total_gross', 'total_paye', 'total_pension', 'total_nhf', 'employee_count'},
#   }
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

## Statutory Deductions

```python
from ngtaxkit import statutory

# Individual deductions
nhf = statutory.nhf(basic_salary=300_000)
nsitf = statutory.nsitf(monthly_payroll=5_000_000)
itf = statutory.itf(annual_payroll=60_000_000, employee_count=25)

# All at once
all_deductions = statutory.calculate_all(
    basic_salary=300_000,
    monthly_payroll=5_000_000,
    annual_payroll=60_000_000,
    employee_count=25,
)
```

## Marketplace Transactions

```python
from ngtaxkit import marketplace

result = marketplace.calculate_transaction(
    sale_amount=100_000,
    platform_commission=0.10,       # 10% commission
    seller_vat_registered=True,
    buyer_type='individual',
    service_category='standard',
)
# → {
#     'sale_amount': 100000,
#     'vat': {'net': 100000, 'vat': 7500, ...},
#     'total_from_buyer': 107500,
#     'platform_commission': {'rate': 0.1, 'amount': 10000, ...},
#     'seller_payout': ...,
#     'wht': {...} or None,
#     'vat_liability': {'collected_by': 'seller', 'amount': 7500, ...},
#   }
```

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

## Key Design Decisions

- **Banker's rounding** — all monetary values use round-half-even to 2 decimal places (Python's `ROUND_HALF_EVEN`)
- **Legal citations** — every result includes a `legal_basis` string citing the NTA 2025 section
- **Versioned rates** — bundled as JSON; override at runtime via `rates.set_custom()`
- **Cross-language parity** — produces identical results to the [TypeScript version](https://www.npmjs.com/package/ngtaxkit), enforced by shared test fixtures
- **Type hints** — full `py.typed` support with strict mypy compliance

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
- [TypeScript version](https://www.npmjs.com/package/ngtaxkit)
