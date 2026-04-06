// ─── Payroll Module ──────────────────────────────────────────────────────────
// Batch payroll calculator with multi-state PAYE aggregation per NTA 2025.
// Delegates individual PAYE to the paye module, groups by state, builds
// StatePayrollSummary from the rates registry.

import type {
  EmployeeInput,
  PayrollBatchResult,
  PayeResult,
  StatePayrollSummary,
  PayrollTotals,
  NigerianState,
} from './types';
import { InvalidStateError } from './errors';
import { calculate as payeCalculate } from './paye';
import { get, type RateValue } from './rates';
import { bankersRound, getRemittanceDeadline } from './utils';

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** Get all valid state codes from the rates registry. */
function getValidStateCodes(): NigerianState[] {
  const jurisdictions = get('state_filing.jurisdictions') as Record<string, RateValue>;
  return Object.keys(jurisdictions) as NigerianState[];
}

/** Validate that a state code exists in the rates registry. */
function validateStateCode(stateCode: string, validStates: NigerianState[]): void {
  if (!validStates.includes(stateCode as NigerianState)) {
    throw new InvalidStateError(
      `Invalid state code "${stateCode}" — must be one of the 37 Nigerian state codes`,
      validStates,
    );
  }
}

/** Build the Form H1 deadline: January 31 of the year following the current tax year. */
function getFormH1Deadline(taxYear: number): string {
  const year = taxYear + 1;
  return `${year}-01-31`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate PAYE for a batch of employees, grouped by state of residence.
 *
 * Steps:
 * 1. Handle empty array → return empty result
 * 2. Validate all state codes upfront
 * 3. Calculate individual PAYE for each employee via paye.calculate
 * 4. Group by stateOfResidence, build StatePayrollSummary per state
 * 5. Compute aggregate totals
 */
export function calculateBatch(employees: EmployeeInput[]): PayrollBatchResult {
  // ── Empty batch ──
  if (employees.length === 0) {
    return {
      employees: [],
      byState: {},
      totals: {
        totalGross: 0,
        totalPaye: 0,
        totalPension: 0,
        totalNhf: 0,
        employeeCount: 0,
      },
    };
  }

  const validStates = getValidStateCodes();
  const currentYear = new Date().getUTCFullYear();

  // ── Validate all state codes upfront ──
  for (const emp of employees) {
    validateStateCode(emp.stateOfResidence, validStates);
  }

  // ── Calculate individual PAYE for each employee ──
  const employeeResults: (PayeResult & { id?: string; name: string; stateOfResidence: NigerianState })[] = [];
  const stateGroups = new Map<NigerianState, {
    employees: typeof employeeResults;
    totalGross: number;
    totalPaye: number;
    totalPension: number;
    totalNhf: number;
  }>();

  for (const emp of employees) {
    const payeResult = payeCalculate({
      grossAnnual: emp.grossAnnual,
      pensionContributing: emp.pensionContributing,
      nhfContributing: emp.nhfContributing,
      rentPaidAnnual: emp.rentPaidAnnual,
    });

    const enriched = {
      ...payeResult,
      id: emp.id,
      name: emp.name,
      stateOfResidence: emp.stateOfResidence,
    };
    employeeResults.push(enriched);

    // Group by state
    const state = emp.stateOfResidence;
    if (!stateGroups.has(state)) {
      stateGroups.set(state, {
        employees: [],
        totalGross: 0,
        totalPaye: 0,
        totalPension: 0,
        totalNhf: 0,
      });
    }
    const group = stateGroups.get(state)!;
    group.employees.push(enriched);
    group.totalGross = bankersRound(group.totalGross + payeResult.grossAnnual);
    group.totalPaye = bankersRound(group.totalPaye + payeResult.annualPaye);
    group.totalPension = bankersRound(group.totalPension + payeResult.pension.employee);
    group.totalNhf = bankersRound(group.totalNhf + payeResult.nhf);
  }

  // ── Build per-state summaries ──
  const byState: Partial<Record<NigerianState, StatePayrollSummary>> = {};
  const today = `${currentYear}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`;

  for (const [stateCode, group] of stateGroups) {
    const stateData = get(`state_filing.jurisdictions.${stateCode}`) as Record<string, RateValue>;

    byState[stateCode] = {
      stateCode,
      stateName: stateData.name as string,
      irsName: stateData.irsName as string,
      employeeCount: group.employees.length,
      totalGross: group.totalGross,
      totalPaye: group.totalPaye,
      totalPension: group.totalPension,
      totalNhf: group.totalNhf,
      filingMethods: stateData.filingMethods as string[],
      portalUrl: stateData.portalUrl as string | null,
      email: stateData.email as string | null,
      address: stateData.address as string | null,
      monthlyRemittanceDeadline: getRemittanceDeadline(today, 10),
      formH1Deadline: getFormH1Deadline(currentYear),
    };
  }

  // ── Compute aggregate totals ──
  const totals: PayrollTotals = {
    totalGross: 0,
    totalPaye: 0,
    totalPension: 0,
    totalNhf: 0,
    employeeCount: employees.length,
  };

  for (const group of stateGroups.values()) {
    totals.totalGross = bankersRound(totals.totalGross + group.totalGross);
    totals.totalPaye = bankersRound(totals.totalPaye + group.totalPaye);
    totals.totalPension = bankersRound(totals.totalPension + group.totalPension);
    totals.totalNhf = bankersRound(totals.totalNhf + group.totalNhf);
  }

  return {
    employees: employeeResults,
    byState,
    totals,
  };
}
