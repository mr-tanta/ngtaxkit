// ─── Cross-Module Non-Negativity Property Tests ─────────────────────────────
// **Validates: Requirements 35.5, 35.6**
// Property 5: Universal non-negativity — all pension, statutory, payroll, VAT,
// and PAYE calculations produce non-negative results for non-negative inputs.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculate as pensionCalculate } from './pension';
import { nhf, nsitf, itf, calculateAll } from './statutory';
import { calculateBatch } from './payroll';
import { calculate as vatCalculate } from './vat';
import { calculate as payeCalculate } from './paye';
import type { EmployeeInput, NigerianState } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_STATES: NigerianState[] = [
  'AB', 'AD', 'AK', 'AN', 'BA', 'BY', 'BE', 'BO',
  'CR', 'DE', 'EB', 'ED', 'EK', 'EN', 'FC', 'GO',
  'IM', 'JI', 'KD', 'KN', 'KT', 'KE', 'KO', 'KW',
  'LA', 'NA', 'NI', 'OG', 'ON', 'OS', 'OY', 'PL',
  'RI', 'SO', 'TA', 'YO', 'ZA',
];

const stateArb = fc.constantFrom(...VALID_STATES);

// ─── 1. Pension Non-Negativity ───────────────────────────────────────────────

describe('Property 5 — Pension: non-negative outputs for non-negative inputs', () => {
  it('all pension output amounts are >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.integer({ min: 0, max: 20_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (basicSalary, housingAllowance, transportAllowance) => {
          const result = pensionCalculate({
            basicSalary,
            housingAllowance,
            transportAllowance,
          });

          expect(result.pensionableEarnings).toBeGreaterThanOrEqual(0);
          expect(result.employeeContribution).toBeGreaterThanOrEqual(0);
          expect(result.employerContribution).toBeGreaterThanOrEqual(0);
          expect(result.totalContribution).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ─── 2. Statutory Non-Negativity ─────────────────────────────────────────────

describe('Property 5 — Statutory: non-negative outputs for non-negative inputs', () => {
  it('NHF amount is >= 0 for non-negative basicSalary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        (basicSalary) => {
          const result = nhf(basicSalary);
          expect(result.nhfAmount).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('NSITF amount is >= 0 for non-negative monthlyPayroll', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        (monthlyPayroll) => {
          const result = nsitf(monthlyPayroll);
          expect(result.nsitfAmount).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('ITF amount is >= 0 for non-negative inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000_000 }),
        fc.integer({ min: 0, max: 1000 }),
        (annualPayroll, employeeCount) => {
          const result = itf({ annualPayroll, employeeCount });
          expect(result.itfAmount).toBeGreaterThanOrEqual(0);
          expect(result.refundAmount).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('calculateAll returns non-negative amounts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 500_000_000 }),
        fc.integer({ min: 0, max: 1000 }),
        (basicSalary, monthlyPayroll, annualPayroll, employeeCount) => {
          const result = calculateAll({
            basicSalary,
            monthlyPayroll,
            annualPayroll,
            employeeCount,
          });

          expect(result.nhf.nhfAmount).toBeGreaterThanOrEqual(0);
          expect(result.nsitf.nsitfAmount).toBeGreaterThanOrEqual(0);
          expect(result.itf.itfAmount).toBeGreaterThanOrEqual(0);
          expect(result.itf.refundAmount).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ─── 3. Payroll Non-Negativity ───────────────────────────────────────────────

describe('Property 5 — Payroll: non-negative outputs for non-negative grossAnnual', () => {
  it('all payroll totals and employee results are >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.constant('Employee'),
            grossAnnual: fc.integer({ min: 0, max: 100_000_000 }),
            stateOfResidence: stateArb,
            pensionContributing: fc.boolean(),
            nhfContributing: fc.boolean(),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (employees) => {
          const result = calculateBatch(employees as EmployeeInput[]);

          // Totals
          expect(result.totals.totalGross).toBeGreaterThanOrEqual(0);
          expect(result.totals.totalPaye).toBeGreaterThanOrEqual(0);
          expect(result.totals.totalPension).toBeGreaterThanOrEqual(0);
          expect(result.totals.totalNhf).toBeGreaterThanOrEqual(0);

          // Per-employee
          for (const emp of result.employees) {
            expect(emp.grossAnnual).toBeGreaterThanOrEqual(0);
            expect(emp.annualPaye).toBeGreaterThanOrEqual(0);
            expect(emp.monthlyPaye).toBeGreaterThanOrEqual(0);
            expect(emp.pension.employee).toBeGreaterThanOrEqual(0);
            expect(emp.pension.employer).toBeGreaterThanOrEqual(0);
            expect(emp.nhf).toBeGreaterThanOrEqual(0);
          }

          // Per-state
          for (const summary of Object.values(result.byState)) {
            expect(summary!.totalGross).toBeGreaterThanOrEqual(0);
            expect(summary!.totalPaye).toBeGreaterThanOrEqual(0);
            expect(summary!.totalPension).toBeGreaterThanOrEqual(0);
            expect(summary!.totalNhf).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ─── 4. VAT Non-Negativity ───────────────────────────────────────────────────

describe('Property 5 — VAT: non-negative outputs for non-negative amounts', () => {
  it('all VAT output amounts are >= 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
        (amount) => {
          if (!Number.isFinite(amount)) return;

          const result = vatCalculate({ amount, category: 'standard' });

          expect(result.net).toBeGreaterThanOrEqual(0);
          expect(result.vat).toBeGreaterThanOrEqual(0);
          expect(result.gross).toBeGreaterThanOrEqual(0);
          expect(result.rate).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── 5. PAYE Non-Negativity ─────────────────────────────────────────────────

describe('Property 5 — PAYE: non-negative outputs for non-negative grossAnnual', () => {
  it('all PAYE output amounts are >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.boolean(),
        fc.boolean(),
        (grossAnnual, pensionContributing, nhfContributing) => {
          const result = payeCalculate({
            grossAnnual,
            pensionContributing,
            nhfContributing,
          });

          expect(result.grossAnnual).toBeGreaterThanOrEqual(0);
          expect(result.grossMonthly).toBeGreaterThanOrEqual(0);
          expect(result.annualPaye).toBeGreaterThanOrEqual(0);
          expect(result.monthlyPaye).toBeGreaterThanOrEqual(0);
          expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
          expect(result.pension.employee).toBeGreaterThanOrEqual(0);
          expect(result.pension.employer).toBeGreaterThanOrEqual(0);
          expect(result.nhf).toBeGreaterThanOrEqual(0);
          expect(result.effectiveRate).toBeGreaterThanOrEqual(0);
          expect(result.reliefs.total).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
