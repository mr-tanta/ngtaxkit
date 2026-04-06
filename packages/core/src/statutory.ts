// ─── Statutory Deductions Module ─────────────────────────────────────────────
// Pure-function calculators for NHF, NSITF, and ITF statutory deductions.
// Zero dependencies, deterministic output, banker's rounding on all monetary values.

import { bankersRound } from './utils';
import { get } from './rates';

// ─── Rate Data ───────────────────────────────────────────────────────────────

const NHF_RATE = get('statutory.nhf.rate') as number;
const NHF_LEGAL_BASIS = get('statutory.nhf.legalBasis') as string;

const NSITF_RATE = get('statutory.nsitf.rate') as number;
const NSITF_LEGAL_BASIS = get('statutory.nsitf.legalBasis') as string;
const NSITF_CONTRIBUTOR_TYPE = get('statutory.nsitf.contributorType') as string;

const ITF_RATE = get('statutory.itf.rate') as number;
const ITF_LEGAL_BASIS = get('statutory.itf.legalBasis') as string;
const ITF_MIN_EMPLOYEES = get('statutory.itf.thresholds.minimumEmployees') as number;
const ITF_MIN_TURNOVER = get('statutory.itf.thresholds.minimumAnnualTurnover') as number;
const ITF_REFUND_MAX_RATE = get('statutory.itf.refund.maxRate') as number;

// ─── Result Types ────────────────────────────────────────────────────────────

export interface NhfResult {
  nhfAmount: number;
  rate: number;
  base: 'basicSalary';
  legalBasis: string;
}

export interface NsitfResult {
  nsitfAmount: number;
  rate: number;
  base: 'monthlyPayroll';
  contributorType: string;
  legalBasis: string;
}

export interface ItfOptions {
  annualPayroll: number;
  employeeCount: number;
  annualTurnover?: number;
  trainingSpend?: number;
}

export interface ItfResult {
  itfAmount: number;
  rate: number;
  eligible: boolean;
  eligibilityBasis?: 'employeeCount' | 'annualTurnover';
  refundAmount: number;
  legalBasis: string;
}

export interface AllStatutoryOptions {
  basicSalary: number;
  monthlyPayroll: number;
  annualPayroll: number;
  employeeCount: number;
  annualTurnover?: number;
  trainingSpend?: number;
}

export interface AllStatutoryResult {
  nhf: NhfResult;
  nsitf: NsitfResult;
  itf: ItfResult;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate National Housing Fund (NHF) contribution.
 * NHF = 2.5% of basic salary (employee contribution).
 */
export function nhf(basicSalary: number): NhfResult {
  return {
    nhfAmount: bankersRound(basicSalary * NHF_RATE),
    rate: NHF_RATE,
    base: 'basicSalary',
    legalBasis: NHF_LEGAL_BASIS,
  };
}

/**
 * Calculate Nigeria Social Insurance Trust Fund (NSITF) contribution.
 * NSITF = 1% of monthly payroll (employer-only contribution).
 */
export function nsitf(monthlyPayroll: number): NsitfResult {
  return {
    nsitfAmount: bankersRound(monthlyPayroll * NSITF_RATE),
    rate: NSITF_RATE,
    base: 'monthlyPayroll',
    contributorType: NSITF_CONTRIBUTOR_TYPE,
    legalBasis: NSITF_LEGAL_BASIS,
  };
}

/**
 * Calculate Industrial Training Fund (ITF) contribution.
 * ITF = 1% of annual payroll for organisations with 5+ employees OR ₦50M+ annual turnover.
 * Refund = min(itfAmount × 50%, trainingSpend).
 */
export function itf(options: ItfOptions): ItfResult {
  const { annualPayroll, employeeCount, annualTurnover = 0, trainingSpend = 0 } = options;

  // Determine eligibility and basis
  const eligibleByEmployees = employeeCount >= ITF_MIN_EMPLOYEES;
  const eligibleByTurnover = annualTurnover >= ITF_MIN_TURNOVER;
  const eligible = eligibleByEmployees || eligibleByTurnover;

  if (!eligible) {
    return {
      itfAmount: 0,
      rate: ITF_RATE,
      eligible: false,
      refundAmount: 0,
      legalBasis: ITF_LEGAL_BASIS,
    };
  }

  const eligibilityBasis: 'employeeCount' | 'annualTurnover' = eligibleByEmployees
    ? 'employeeCount'
    : 'annualTurnover';

  const itfAmount = bankersRound(annualPayroll * ITF_RATE);
  const maxRefund = bankersRound(itfAmount * ITF_REFUND_MAX_RATE);
  const refundAmount = Math.min(maxRefund, trainingSpend);

  return {
    itfAmount,
    rate: ITF_RATE,
    eligible: true,
    eligibilityBasis,
    refundAmount,
    legalBasis: ITF_LEGAL_BASIS,
  };
}

/**
 * Calculate all statutory deductions (NHF + NSITF + ITF) in a single call.
 */
export function calculateAll(options: AllStatutoryOptions): AllStatutoryResult {
  return {
    nhf: nhf(options.basicSalary),
    nsitf: nsitf(options.monthlyPayroll),
    itf: itf({
      annualPayroll: options.annualPayroll,
      employeeCount: options.employeeCount,
      annualTurnover: options.annualTurnover,
      trainingSpend: options.trainingSpend,
    }),
  };
}
