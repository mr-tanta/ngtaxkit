# Rate Registry

Rates are bundled as JSON under `shared/rates/` and copied into the Python package data. TypeScript imports the shared JSON directly.

## Public APIs

TypeScript:

```typescript
import { rates } from 'ngtaxkit';

rates.get('vat.standard.rate');
rates.getVersion();
rates.getEffectiveDate();
rates.explain('wht.serviceTypes.professional.company');
rates.audit();
rates.setCustom({ 'vat.standard.rate': 0.10 });
rates.clearCustom();
```

Python:

```python
from ngtaxkit import rates

rates.get("vat.standard.rate")
rates.get_version()
rates.get_effective_date()
rates.explain("wht.serviceTypes.professional.company")
rates.audit()
rates.set_custom({"vat.standard.rate": 0.10})
rates.clear_custom()
```

## Source Metadata

`source_metadata_2026.json` maps exact keys or prefixes to source records. Exact keys win first; otherwise the nearest parent prefix is used.

Example:

- `wht.serviceTypes.professional.individual`
- falls back to `wht.serviceTypes.professional`
- returns the requested key/value with the professional-service WHT source record

This keeps the metadata compact while still allowing end-user explanations for leaf rates.

## Current Source Families

| Domain | Primary source family | Status |
|--------|-----------------------|--------|
| VAT | Nigeria Tax Act, 2025 | verified |
| PAYE | Nigeria Tax Act, 2025 | verified |
| WHT | Deduction of Tax at Source Regulations, 2024 | verified, medium confidence where professional-hosted gazette copy is used |
| Pension | Pension Reform Act 2014 / PenCom | verified |
| Statutory | NHF, NSITF, ITF public references | needs_review |
| State filing | State IRS public channels | needs_review |

## Audit Output

`rates.audit()` returns:

- version and effective date
- total leaf keys in the bundled registry
- verified / needs_review / disputed coverage counts
- missing metadata keys
- orphaned metadata keys
- all source records

Use this in CI or release checks before publishing new rate files.

See [release-checklist.md](release-checklist.md) for the artifact and source-review gates used before publishing.
