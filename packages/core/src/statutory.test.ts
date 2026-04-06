import { describe, it, expect } from 'vitest';
import * as statutory from './statutory';
import testCases from '../../../shared/fixtures/statutory_test_cases.json';

// ─── Types for fixture data ─────────────────────────────────────────────────

interface NhfInput {
  function: 'nhf';
  basicSalary: number;
}

interface NsitfInput {
  function: 'nsitf';
  monthlyPayroll: number;
}

interface ItfInput {
  function: 'itf';
  annualPayroll: number;
  employeeCount: number;
  annualTurnover?: number;
  trainingSpend?: number;
}

interface CalculateAllInput {
  function: 'calculateAll';
  basicSalary: number;
  monthlyPayroll: number;
  annualPayroll: number;
  employeeCount: number;
  annualTurnover?: number;
  trainingSpend?: number;
}

type TestInput = NhfInput | NsitfInput | ItfInput | CalculateAllInput;

interface TestCase {
  description: string;
  input: TestInput;
  expected: Record<string, unknown>;
}

// ─── 9.2: Unit Tests — Shared Fixtures ──────────────────────────────────────

describe('Statutory Module — shared fixtures', () => {
  for (const tc of testCases as TestCase[]) {
    it(tc.description, () => {
      switch (tc.input.function) {
        case 'nhf': {
          const result = statutory.nhf(tc.input.basicSalary);
          expect(result.nhfAmount).toBe(tc.expected.nhfAmount);
          expect(result.rate).toBe(tc.expected.rate);
          expect(result.base).toBe(tc.expected.base);
          break;
        }
        case 'nsitf': {
          const result = statutory.nsitf(tc.input.monthlyPayroll);
          expect(result.nsitfAmount).toBe(tc.expected.nsitfAmount);
          expect(result.rate).toBe(tc.expected.rate);
          expect(result.base).toBe(tc.expected.base);
          expect(result.contributorType).toBe(tc.expected.contributorType);
          break;
        }
        case 'itf': {
          const input = tc.input as ItfInput;
          const result = statutory.itf({
            annualPayroll: input.annualPayroll,
            employeeCount: input.employeeCount,
            annualTurnover: input.annualTurnover,
            trainingSpend: input.trainingSpend,
          });
          expect(result.itfAmount).toBe(tc.expected.itfAmount);
          expect(result.rate).toBe(tc.expected.rate);
          expect(result.eligible).toBe(tc.expected.eligible);
          if (tc.expected.eligibilityBasis !== undefined) {
            expect(result.eligibilityBasis).toBe(tc.expected.eligibilityBasis);
          }
          expect(result.refundAmount).toBe(tc.expected.refundAmount);
          break;
        }
        case 'calculateAll': {
          const input = tc.input as CalculateAllInput;
          const result = statutory.calculateAll({
            basicSalary: input.basicSalary,
            monthlyPayroll: input.monthlyPayroll,
            annualPayroll: input.annualPayroll,
            employeeCount: input.employeeCount,
            annualTurnover: input.annualTurnover,
            trainingSpend: input.trainingSpend,
          });
          const expNhf = tc.expected.nhf as Record<string, unknown>;
          const expNsitf = tc.expected.nsitf as Record<string, unknown>;
          const expItf = tc.expected.itf as Record<string, unknown>;

          expect(result.nhf.nhfAmount).toBe(expNhf.nhfAmount);
          expect(result.nhf.rate).toBe(expNhf.rate);
          expect(result.nsitf.nsitfAmount).toBe(expNsitf.nsitfAmount);
          expect(result.nsitf.rate).toBe(expNsitf.rate);
          expect(result.itf.itfAmount).toBe(expItf.itfAmount);
          expect(result.itf.rate).toBe(expItf.rate);
          expect(result.itf.eligible).toBe(expItf.eligible);
          break;
        }
      }
    });
  }
});

// ─── 9.2: ITF threshold logic ───────────────────────────────────────────────

describe('Statutory Module — ITF threshold logic', () => {
  it('eligible at exactly 5 employees', () => {
    const result = statutory.itf({
      annualPayroll: 30_000_000,
      employeeCount: 5,
      annualTurnover: 20_000_000,
    });
    expect(result.eligible).toBe(true);
    expect(result.eligibilityBasis).toBe('employeeCount');
  });

  it('not eligible at 4 employees with turnover below ₦50M', () => {
    const result = statutory.itf({
      annualPayroll: 20_000_000,
      employeeCount: 4,
      annualTurnover: 49_999_999,
    });
    expect(result.eligible).toBe(false);
    expect(result.itfAmount).toBe(0);
  });

  it('eligible at exactly ₦50M turnover with fewer than 5 employees', () => {
    const result = statutory.itf({
      annualPayroll: 25_000_000,
      employeeCount: 4,
      annualTurnover: 50_000_000,
    });
    expect(result.eligible).toBe(true);
    expect(result.eligibilityBasis).toBe('annualTurnover');
  });

  it('prefers employeeCount basis when both thresholds met', () => {
    const result = statutory.itf({
      annualPayroll: 60_000_000,
      employeeCount: 10,
      annualTurnover: 100_000_000,
    });
    expect(result.eligible).toBe(true);
    expect(result.eligibilityBasis).toBe('employeeCount');
  });
});

// ─── 9.2: ITF refund calculation ────────────────────────────────────────────

describe('Statutory Module — ITF refund calculation', () => {
  it('refund is 0 when no training spend', () => {
    const result = statutory.itf({
      annualPayroll: 60_000_000,
      employeeCount: 10,
    });
    expect(result.refundAmount).toBe(0);
  });

  it('refund capped at 50% of ITF contribution', () => {
    const result = statutory.itf({
      annualPayroll: 50_000_000,
      employeeCount: 8,
      trainingSpend: 1_000_000,
    });
    // ITF = 500,000; 50% cap = 250,000; training spend = 1,000,000
    expect(result.refundAmount).toBe(250_000);
  });

  it('refund equals training spend when below 50% cap', () => {
    const result = statutory.itf({
      annualPayroll: 80_000_000,
      employeeCount: 20,
      trainingSpend: 200_000,
    });
    // ITF = 800,000; 50% cap = 400,000; training spend = 200,000
    expect(result.refundAmount).toBe(200_000);
  });
});

// ─── 9.2: Result metadata ───────────────────────────────────────────────────

describe('Statutory Module — result metadata', () => {
  it('NHF includes legalBasis citing National Housing Fund Act', () => {
    const result = statutory.nhf(300_000);
    expect(result.legalBasis).toContain('National Housing Fund Act');
  });

  it('NSITF includes legalBasis citing Employee Compensation Act', () => {
    const result = statutory.nsitf(5_000_000);
    expect(result.legalBasis).toContain('Employee Compensation Act');
  });

  it('ITF includes legalBasis citing Industrial Training Fund Act', () => {
    const result = statutory.itf({
      annualPayroll: 60_000_000,
      employeeCount: 10,
    });
    expect(result.legalBasis).toContain('Industrial Training Fund Act');
  });

  it('NSITF contributorType is employer', () => {
    const result = statutory.nsitf(5_000_000);
    expect(result.contributorType).toBe('employer');
  });
});
