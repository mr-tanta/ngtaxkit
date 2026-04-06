import { describe, it, expect } from 'vitest';
import * as pension from './pension';
import { InvalidPensionRateError } from './errors';
import testCases from '../../../shared/fixtures/pension_test_cases.json';

// ─── Types for fixture data ─────────────────────────────────────────────────

interface PensionInput {
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  employeeRate?: number;
  employerRate?: number;
  salaryPaymentDate?: string;
}

interface PensionExpected {
  pensionableEarnings: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  remittanceDeadline?: string;
}

interface PensionTestCase {
  description: string;
  input: PensionInput;
  expected?: PensionExpected;
  expectedError?: { code: string };
}

// ─── 8.2: Unit Tests — Shared Fixtures ──────────────────────────────────────

describe('Pension Module — shared fixtures', () => {
  for (const tc of testCases as PensionTestCase[]) {
    if ('expectedError' in tc && tc.expectedError) {
      it(tc.description, () => {
        expect(() =>
          pension.calculate({
            basicSalary: tc.input.basicSalary,
            housingAllowance: tc.input.housingAllowance,
            transportAllowance: tc.input.transportAllowance,
            employeeRate: tc.input.employeeRate,
            employerRate: tc.input.employerRate,
            salaryPaymentDate: tc.input.salaryPaymentDate,
          }),
        ).toThrow(InvalidPensionRateError);
      });
    } else {
      it(tc.description, () => {
        const result = pension.calculate({
          basicSalary: tc.input.basicSalary,
          housingAllowance: tc.input.housingAllowance,
          transportAllowance: tc.input.transportAllowance,
          employeeRate: tc.input.employeeRate,
          employerRate: tc.input.employerRate,
          salaryPaymentDate: tc.input.salaryPaymentDate,
        });

        expect(result.pensionableEarnings).toBe(tc.expected!.pensionableEarnings);
        expect(result.employeeContribution).toBe(tc.expected!.employeeContribution);
        expect(result.employerContribution).toBe(tc.expected!.employerContribution);
        expect(result.totalContribution).toBe(tc.expected!.totalContribution);

        if (tc.expected!.remittanceDeadline) {
          expect(result.remittanceDeadline).toBe(tc.expected!.remittanceDeadline);
        }
      });
    }
  }
});

// ─── 8.2: Minimum rate validation ───────────────────────────────────────────

describe('Pension Module — minimum rate validation', () => {
  it('throws InvalidPensionRateError for employee rate below 8%', () => {
    expect(() =>
      pension.calculate({
        basicSalary: 300_000,
        housingAllowance: 100_000,
        transportAllowance: 50_000,
        employeeRate: 0.05,
      }),
    ).toThrow(InvalidPensionRateError);
  });

  it('throws InvalidPensionRateError for employer rate below 10%', () => {
    expect(() =>
      pension.calculate({
        basicSalary: 300_000,
        housingAllowance: 100_000,
        transportAllowance: 50_000,
        employerRate: 0.07,
      }),
    ).toThrow(InvalidPensionRateError);
  });

  it('accepts exactly 8% employee rate', () => {
    const result = pension.calculate({
      basicSalary: 200_000,
      employeeRate: 0.08,
    });
    expect(result.employeeContribution).toBe(16_000);
  });

  it('accepts exactly 10% employer rate', () => {
    const result = pension.calculate({
      basicSalary: 200_000,
      employerRate: 0.10,
    });
    expect(result.employerContribution).toBe(20_000);
  });

  it('InvalidPensionRateError has correct error code', () => {
    try {
      pension.calculate({
        basicSalary: 300_000,
        employeeRate: 0.05,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidPensionRateError);
      expect((e as InvalidPensionRateError).code).toBe('NGTK_INVALID_PENSION_RATE');
    }
  });
});

// ─── 8.2: Custom rates ──────────────────────────────────────────────────────

describe('Pension Module — custom rates', () => {
  it('accepts custom employee rate of 10%', () => {
    const result = pension.calculate({
      basicSalary: 500_000,
      housingAllowance: 200_000,
      transportAllowance: 100_000,
      employeeRate: 0.10,
    });
    expect(result.employeeContribution).toBe(80_000);
  });

  it('accepts custom employer rate of 15%', () => {
    const result = pension.calculate({
      basicSalary: 500_000,
      housingAllowance: 200_000,
      transportAllowance: 100_000,
      employerRate: 0.15,
    });
    expect(result.employerContribution).toBe(120_000);
  });
});

// ─── 8.2: Deadline calculation ───────────────────────────────────────────────

describe('Pension Module — deadline calculation', () => {
  it('calculates 7 working days from Monday 2026-03-02', () => {
    const result = pension.calculate({
      basicSalary: 250_000,
      housingAllowance: 100_000,
      transportAllowance: 50_000,
      salaryPaymentDate: '2026-03-02',
    });
    expect(result.remittanceDeadline).toBe('2026-03-11');
  });

  it('calculates 7 working days from Friday 2026-01-30', () => {
    const result = pension.calculate({
      basicSalary: 250_000,
      housingAllowance: 100_000,
      transportAllowance: 50_000,
      salaryPaymentDate: '2026-01-30',
    });
    expect(result.remittanceDeadline).toBe('2026-02-10');
  });
});

// ─── 8.2: Result metadata ───────────────────────────────────────────────────

describe('Pension Module — result metadata', () => {
  it('includes legalBasis citing PRA 2014', () => {
    const result = pension.calculate({ basicSalary: 200_000 });
    expect(result.legalBasis).toContain('Pension Reform Act (PRA) 2014');
  });

  it('includes remittanceMethod', () => {
    const result = pension.calculate({ basicSalary: 200_000 });
    expect(result.remittanceMethod).toBe('PFA transfer');
  });
});
