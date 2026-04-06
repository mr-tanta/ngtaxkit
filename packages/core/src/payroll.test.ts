import { describe, it, expect } from 'vitest';
import { calculateBatch } from './payroll';
import { InvalidStateError } from './errors';
import type { EmployeeInput, NigerianState } from './types';

// ─── Load shared fixtures ────────────────────────────────────────────────────
import payrollTestCases from '../../../shared/fixtures/payroll_test_cases.json';

interface PayrollFixture {
  description: string;
  input: {
    employees: Array<{
      id?: string;
      name: string;
      grossAnnual: number;
      stateOfResidence: string;
      pensionContributing?: boolean;
      nhfContributing?: boolean;
      rentPaidAnnual?: number;
    }>;
  };
  expected?: {
    employeeCount: number;
    employees?: Array<{
      id: string;
      name: string;
      grossAnnual: number;
      stateOfResidence: string;
      exempt?: boolean;
      annualPaye?: number;
      monthlyPaye?: number;
    }>;
    byState: Record<string, {
      stateCode: string;
      stateName: string;
      irsName: string;
      employeeCount: number;
      totalPaye?: number;
      filingMethods: string[];
      portalUrl: string | null;
      formH1Deadline: string;
    }>;
    totals: {
      totalGross: number;
      totalPaye?: number;
      totalPension?: number;
      totalNhf?: number;
      employeeCount: number;
    };
  };
  expectedError?: {
    code: string;
  };
}

const fixtures = payrollTestCases as PayrollFixture[];

// ─── 11.2: Unit Tests — Shared Fixtures ──────────────────────────────────────

describe('Payroll Module — shared fixture tests', () => {
  for (const tc of fixtures) {
    if (tc.expectedError) {
      it(`${tc.description} — throws ${tc.expectedError.code}`, () => {
        const employees = tc.input.employees as EmployeeInput[];
        expect(() => calculateBatch(employees)).toThrow(InvalidStateError);
        try {
          calculateBatch(employees);
        } catch (e) {
          expect((e as InvalidStateError).code).toBe(tc.expectedError!.code);
        }
      });
    } else {
      it(tc.description, () => {
        const employees = tc.input.employees as EmployeeInput[];
        const result = calculateBatch(employees);

        // Check employee count
        expect(result.employees.length).toBe(tc.expected!.employeeCount);
        expect(result.totals.employeeCount).toBe(tc.expected!.totals.employeeCount);

        // Check totals
        expect(result.totals.totalGross).toBe(tc.expected!.totals.totalGross);
        if (tc.expected!.totals.totalPaye !== undefined) {
          expect(result.totals.totalPaye).toBe(tc.expected!.totals.totalPaye);
        }
        if (tc.expected!.totals.totalPension !== undefined) {
          expect(result.totals.totalPension).toBe(tc.expected!.totals.totalPension);
        }
        if (tc.expected!.totals.totalNhf !== undefined) {
          expect(result.totals.totalNhf).toBe(tc.expected!.totals.totalNhf);
        }

        // Check byState structure
        for (const [stateCode, expectedState] of Object.entries(tc.expected!.byState)) {
          const actualState = result.byState[stateCode as NigerianState];
          expect(actualState).toBeDefined();
          expect(actualState!.stateCode).toBe(expectedState.stateCode);
          expect(actualState!.stateName).toBe(expectedState.stateName);
          expect(actualState!.irsName).toBe(expectedState.irsName);
          expect(actualState!.employeeCount).toBe(expectedState.employeeCount);
          expect(actualState!.filingMethods).toEqual(expectedState.filingMethods);
          expect(actualState!.portalUrl).toBe(expectedState.portalUrl);
          expect(actualState!.formH1Deadline).toBe(expectedState.formH1Deadline);

          if (expectedState.totalPaye !== undefined) {
            expect(actualState!.totalPaye).toBe(expectedState.totalPaye);
          }
        }

        // Check individual employees if specified
        if (tc.expected!.employees) {
          for (let i = 0; i < tc.expected!.employees.length; i++) {
            const expectedEmp = tc.expected!.employees[i];
            const actualEmp = result.employees[i];
            expect(actualEmp.id).toBe(expectedEmp.id);
            expect(actualEmp.name).toBe(expectedEmp.name);
            expect(actualEmp.grossAnnual).toBe(expectedEmp.grossAnnual);
            expect(actualEmp.stateOfResidence).toBe(expectedEmp.stateOfResidence);
            if (expectedEmp.exempt !== undefined) {
              expect(actualEmp.exempt).toBe(expectedEmp.exempt);
            }
            if (expectedEmp.annualPaye !== undefined) {
              expect(actualEmp.annualPaye).toBe(expectedEmp.annualPaye);
            }
            if (expectedEmp.monthlyPaye !== undefined) {
              expect(actualEmp.monthlyPaye).toBe(expectedEmp.monthlyPaye);
            }
          }
        }
      });
    }
  }
});

// ─── 11.2: Unit Tests — Multi-state grouping ────────────────────────────────

describe('Payroll Module — multi-state grouping', () => {
  it('groups employees by state correctly', () => {
    const employees: EmployeeInput[] = [
      { name: 'A', grossAnnual: 3000000, stateOfResidence: 'LA' },
      { name: 'B', grossAnnual: 4000000, stateOfResidence: 'FC' },
      { name: 'C', grossAnnual: 2000000, stateOfResidence: 'LA' },
    ];
    const result = calculateBatch(employees);

    expect(Object.keys(result.byState)).toHaveLength(2);
    expect(result.byState.LA!.employeeCount).toBe(2);
    expect(result.byState.FC!.employeeCount).toBe(1);
    expect(result.totals.employeeCount).toBe(3);
  });
});

// ─── 11.2: Unit Tests — Empty batch ─────────────────────────────────────────

describe('Payroll Module — empty batch', () => {
  it('returns empty result for empty array', () => {
    const result = calculateBatch([]);
    expect(result.employees).toEqual([]);
    expect(result.byState).toEqual({});
    expect(result.totals).toEqual({
      totalGross: 0,
      totalPaye: 0,
      totalPension: 0,
      totalNhf: 0,
      employeeCount: 0,
    });
  });
});

// ─── 11.2: Unit Tests — Invalid state code ──────────────────────────────────

describe('Payroll Module — invalid state code', () => {
  it('throws InvalidStateError for unknown state code', () => {
    const employees = [
      { name: 'Test', grossAnnual: 2000000, stateOfResidence: 'XX' as NigerianState },
    ];
    expect(() => calculateBatch(employees)).toThrow(InvalidStateError);
  });

  it('InvalidStateError includes valid states list', () => {
    const employees = [
      { name: 'Test', grossAnnual: 2000000, stateOfResidence: 'ZZ' as NigerianState },
    ];
    try {
      calculateBatch(employees);
    } catch (e) {
      const err = e as InvalidStateError;
      expect(err.code).toBe('NGTK_INVALID_STATE');
      expect(err.validStates.length).toBe(37);
      expect(err.validStates).toContain('LA');
      expect(err.validStates).toContain('FC');
    }
  });
});
