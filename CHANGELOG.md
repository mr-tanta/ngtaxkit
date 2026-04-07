# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.0.5] - 2026-04-07

### Fixed

- Bundle @ngtaxkit/core into the npm package instead of listing it as an external dependency
- `npm install ngtaxkit` now works without needing @ngtaxkit/core separately

### Added

- Django model fields (TINField, NairaField, VATCategoryField) and template tags
- Flask blueprint with tax calculation endpoints and Jinja2 filters
- FastAPI router with Pydantic request models

## [0.0.3] - 2026-04-06

### Added

- Python invoice module — create, validate, to_firs_json, to_csv
- Python UBL 3.0 XML generation (byte-identical parity with TypeScript)
- Python PDF generators: invoice, WHT credit note, Form H1, payslip, VAT return (fpdf2)
- Cross-language parity fixtures for invoice and UBL modules (12 shared test cases)
- TypeScript parity tests for invoice and UBL against shared fixtures

## [0.0.2] - 2026-04-06

### Fixed

- Added package README for npm and PyPI registry pages
- Added author social links (GitHub, LinkedIn, X)

## [0.0.1] - 2026-04-06

### Added

- VAT calculation with standard, zero-rated, and exempt categories
- PAYE income tax with NTA 2025 graduated brackets and reliefs
- WHT calculation by service type with credit note support
- Pension (CPS) employee/employer contributions per PRA 2014
- NHF, NSITF, ITF statutory deductions
- Marketplace transaction calculator (VAT + commission + WHT + payout)
- Payroll batch processing with per-state aggregation and filing info
- Invoice PDF generation with VAT line items
- UBL 3.0 XML invoice generation for FIRSMBS e-invoicing
- FIRS JSON and CSV export formats
- WHT credit note, Form H1, Payslip, VAT return PDF generators
- Python port with full calculation parity (89 shared test fixtures)
- Versioned rate registry with runtime override support
- Property-based test suites (fast-check + Hypothesis)
