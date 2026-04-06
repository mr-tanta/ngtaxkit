// ─── WHT Module ──────────────────────────────────────────────────────────────
// Pure-function Withholding Tax calculation engine per WHT Regulations 2024.
// Zero dependencies, deterministic output, banker's rounding on all monetary values.

import type { WhtServiceType, WhtCalculateOptions, WhtResult } from './types';
import { InvalidServiceTypeError } from './errors';
import { bankersRound } from './utils';
import { get } from './rates';

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** All recognised WHT service types. */
const ALL_SERVICE_TYPES: WhtServiceType[] = [
  'professional',
  'management',
  'technical',
  'consultancy',
  'commission',
  'construction',
  'contract',
  'rent',
  'royalty',
  'dividend',
  'interest',
];

/** Small company exemption threshold from rate data. */
const SMALL_COMPANY_THRESHOLD = get('wht.smallCompanyExemption.threshold') as number;
const SMALL_COMPANY_LEGAL_BASIS = get('wht.smallCompanyExemption.legalBasis') as string;
const REMITTANCE_DAY = get('wht.remittanceDeadline.dayOfMonth') as number;

/**
 * Validate that a service type is recognised.
 */
function validateServiceType(serviceType: string): asserts serviceType is WhtServiceType {
  if (!ALL_SERVICE_TYPES.includes(serviceType as WhtServiceType)) {
    throw new InvalidServiceTypeError(
      `Unknown WHT service type "${serviceType}"`,
      ALL_SERVICE_TYPES,
    );
  }
}

/**
 * Calculate the remittance deadline as the Nth day of the month following the payment date.
 * Per WHT Regulations 2024: 21st of the following month, no working-day adjustment.
 */
function calcRemittanceDeadline(paymentDate: string, dayOfMonth: number): string {
  const [year, month] = paymentDate.split('-').map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  // Clamp to last day of month
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const clampedDay = Math.min(dayOfMonth, lastDay);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate WHT on a payment.
 *
 * Looks up the rate by serviceType × payeeType, applies small company exemption
 * when applicable, and computes remittance deadline (21st of following month).
 *
 * Accepts an optional `paymentDate` (ISO string) for remittance deadline calculation.
 * Defaults to the current date if not provided.
 */
export function calculate(
  options: WhtCalculateOptions & { paymentDate?: string },
): WhtResult {
  const {
    amount,
    payeeType,
    serviceType,
    payeeIsSmallCompany = false,
    paymentDate,
  } = options;

  validateServiceType(serviceType);

  const rate = getRate(serviceType, payeeType);
  const legalBasis = get(`wht.serviceTypes.${serviceType}.legalBasis`) as string;

  // Determine payment date for remittance deadline
  const effectiveDate = paymentDate ?? new Date().toISOString().slice(0, 10);
  const remittanceDeadline = calcRemittanceDeadline(effectiveDate, REMITTANCE_DAY);

  // Small company exemption: payee is small company AND amount ≤ threshold
  if (payeeIsSmallCompany && amount <= SMALL_COMPANY_THRESHOLD) {
    return {
      grossAmount: amount,
      rate,
      whtAmount: 0,
      netPayment: amount,
      exempt: true,
      exemptionBasis: SMALL_COMPANY_LEGAL_BASIS,
      remittanceDeadline,
      creditNoteRequired: false,
      legalBasis,
    };
  }

  const whtAmount = bankersRound(amount * rate);
  const netPayment = bankersRound(amount - whtAmount);

  return {
    grossAmount: amount,
    rate,
    whtAmount,
    netPayment,
    exempt: false,
    exemptionBasis: null,
    remittanceDeadline,
    creditNoteRequired: whtAmount > 0,
    legalBasis,
  };
}

/**
 * Get the WHT rate for a service type and payee type.
 */
export function getRate(
  serviceType: WhtServiceType,
  payeeType: 'individual' | 'company',
): number {
  validateServiceType(serviceType);
  return get(`wht.serviceTypes.${serviceType}.${payeeType}`) as number;
}

/**
 * List all recognised WHT service types.
 */
export function listServiceTypes(): WhtServiceType[] {
  return [...ALL_SERVICE_TYPES];
}
