// ─── WHT Module ──────────────────────────────────────────────────────────────
// Pure-function Withholding Tax calculation engine per WHT Regulations 2024.
// Zero dependencies, deterministic output, banker's rounding on all monetary values.

import type { CalculationExplanation, WhtServiceType, WhtCalculateOptions, WhtResult } from './types';
import { InvalidServiceTypeError, ValidationError } from './errors';
import { assertNonNegativeFinite, bankersRound } from './utils';
import { get } from './rates';
import { collectRateSources, uniqueRateKeys } from './explain';

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

function validatePayeeType(payeeType: string): asserts payeeType is 'individual' | 'company' {
  if (payeeType !== 'individual' && payeeType !== 'company') {
    throw new ValidationError(
      `Unknown WHT payee type "${payeeType}"`,
      [{ field: 'payeeType', message: 'Must be "individual" or "company"' }],
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

  assertNonNegativeFinite('amount', amount);
  validatePayeeType(payeeType);
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
 * Calculate WHT and return the source-backed reasoning used for the result.
 */
export function explainCalculate(
  options: WhtCalculateOptions & { paymentDate?: string },
): CalculationExplanation<WhtResult> {
  const {
    amount,
    payeeType,
    serviceType,
    payeeIsSmallCompany = false,
    payeeTin,
    paymentDate,
  } = options;
  const effectivePaymentDate = paymentDate ?? new Date().toISOString().slice(0, 10);
  const normalizedOptions = {
    amount,
    payeeType,
    serviceType,
    payeeIsSmallCompany,
    payeeTin,
    paymentDate: effectivePaymentDate,
  };
  const result = calculate(normalizedOptions);
  const rateKeys = uniqueRateKeys([
    `wht.serviceTypes.${serviceType}.${payeeType}`,
    'wht.remittanceDeadline.dayOfMonth',
    ...(payeeIsSmallCompany ? ['wht.smallCompanyExemption.threshold'] : []),
  ]);
  const { sources, warnings } = collectRateSources(rateKeys);

  const formula = result.exempt
    ? [
        `Gross amount = ${amount}.`,
        'Small company exemption applies because the payee is marked as a small company and the gross amount is at or below the exemption threshold.',
        'WHT amount = 0.',
        'Net payment = gross amount.',
      ]
    : [
        `Gross amount = ${amount}.`,
        'WHT amount = gross amount * withholding rate.',
        'Net payment = gross amount - WHT amount.',
        'Remittance deadline = configured day of the month following the payment date.',
      ];

  const assumptions = [
    'Amounts are denominated in Nigerian naira.',
    "Monetary values use banker's rounding to 2 decimal places.",
    `Payment date ${effectivePaymentDate} is used for the remittance deadline.`,
  ];

  if (!payeeTin) {
    assumptions.push('No payee TIN was supplied; the bundled WHT calculator currently does not alter rates by TIN availability.');
  }

  return {
    inputs: normalizedOptions,
    result,
    formula,
    assumptions,
    rateKeys,
    sources,
    warnings,
  };
}

/**
 * Get the WHT rate for a service type and payee type.
 */
export function getRate(
  serviceType: WhtServiceType,
  payeeType: 'individual' | 'company',
): number {
  validatePayeeType(payeeType);
  validateServiceType(serviceType);
  return get(`wht.serviceTypes.${serviceType}.${payeeType}`) as number;
}

/**
 * List all recognised WHT service types.
 */
export function listServiceTypes(): WhtServiceType[] {
  return [...ALL_SERVICE_TYPES];
}
