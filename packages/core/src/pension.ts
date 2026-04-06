// ─── Pension Module ──────────────────────────────────────────────────────────
// Pure-function pension contribution calculator per PRA 2014 (Contributory Pension Scheme).
// Zero dependencies, deterministic output, banker's rounding on all monetary values.

import type { PensionCalculateOptions, PensionResult } from './types';
import { InvalidPensionRateError } from './errors';
import { bankersRound, addWorkingDays } from './utils';
import { get } from './rates';

// ─── Rate Data ───────────────────────────────────────────────────────────────

const MIN_EMPLOYEE_RATE = get('pension.minimumRates.employee') as number; // 0.08
const MIN_EMPLOYER_RATE = get('pension.minimumRates.employer') as number; // 0.10
const DEADLINE_WORKING_DAYS = get('pension.remittance.deadlineWorkingDays') as number; // 7
const LEGAL_BASIS = get('pension.legalBasis') as string;
const REMITTANCE_METHOD = 'PFA transfer';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate pension contributions under the Contributory Pension Scheme (CPS).
 *
 * Pensionable earnings = basicSalary + housingAllowance + transportAllowance.
 * Employee contributes at least 8%, employer at least 10%. Custom rates above
 * the minimum are accepted.
 *
 * If `salaryPaymentDate` is provided, the remittance deadline is calculated as
 * 7 working days after that date (skipping weekends and Nigerian public holidays).
 */
export function calculate(
  options: PensionCalculateOptions & { salaryPaymentDate?: string },
): PensionResult {
  const {
    basicSalary,
    housingAllowance = 0,
    transportAllowance = 0,
    employeeRate = MIN_EMPLOYEE_RATE,
    employerRate = MIN_EMPLOYER_RATE,
    salaryPaymentDate,
  } = options;

  // ── Validate minimum rates ──────────────────────────────────────────────
  if (employeeRate < MIN_EMPLOYEE_RATE) {
    throw new InvalidPensionRateError(
      `Employee pension rate ${employeeRate} is below the legal minimum of ${MIN_EMPLOYEE_RATE} (${MIN_EMPLOYEE_RATE * 100}%)`,
      'PRA 2014, Section 4(1)',
    );
  }

  if (employerRate < MIN_EMPLOYER_RATE) {
    throw new InvalidPensionRateError(
      `Employer pension rate ${employerRate} is below the legal minimum of ${MIN_EMPLOYER_RATE} (${MIN_EMPLOYER_RATE * 100}%)`,
      'PRA 2014, Section 4(1)',
    );
  }

  // ── Calculate contributions ─────────────────────────────────────────────
  const pensionableEarnings = basicSalary + housingAllowance + transportAllowance;
  const employeeContribution = bankersRound(pensionableEarnings * employeeRate);
  const employerContribution = bankersRound(pensionableEarnings * employerRate);
  const totalContribution = bankersRound(employeeContribution + employerContribution);

  // ── Remittance deadline ─────────────────────────────────────────────────
  const remittanceDeadline = salaryPaymentDate
    ? addWorkingDays(salaryPaymentDate, DEADLINE_WORKING_DAYS)
    : addWorkingDays(new Date().toISOString().slice(0, 10), DEADLINE_WORKING_DAYS);

  return {
    pensionableEarnings,
    employeeContribution,
    employerContribution,
    totalContribution,
    remittanceDeadline,
    remittanceMethod: REMITTANCE_METHOD,
    legalBasis: LEGAL_BASIS,
  };
}
