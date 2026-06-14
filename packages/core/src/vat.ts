// ─── VAT Module ──────────────────────────────────────────────────────────────
// Pure-function VAT calculation engine for Nigerian VAT per NTA 2025.
// Zero dependencies, deterministic output, banker's rounding on all monetary values.

import type { CalculationExplanation, TaxCategory, VatCalculateOptions, VatResult } from './types';
import { InvalidCategoryError } from './errors';
import { assertNonNegativeFinite, bankersRound, parseIsoDateParts } from './utils';
import { get } from './rates';
import { collectRateSources } from './explain';

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** All recognised VAT categories. */
const ZERO_RATED_CATEGORIES: ReadonlySet<string> = new Set([
  'basic-food',
  'medicine',
  'medical-equipment',
  'medical-services',
  'educational-books',
  'tuition',
  'electricity',
  'export-services',
  'humanitarian-goods',
]);

const EXEMPT_CATEGORIES: ReadonlySet<string> = new Set([
  'residential-rent',
  'public-transport',
  'financial-services',
  'insurance',
]);

const ALL_CATEGORIES: TaxCategory[] = [
  'standard',
  ...Array.from(ZERO_RATED_CATEGORIES) as TaxCategory[],
  ...Array.from(EXEMPT_CATEGORIES) as TaxCategory[],
];

/**
 * Determine the rate type for a given category.
 */
function classifyCategory(category: TaxCategory): 'standard' | 'zero-rated' | 'exempt' {
  if (ZERO_RATED_CATEGORIES.has(category)) return 'zero-rated';
  if (EXEMPT_CATEGORIES.has(category)) return 'exempt';
  return 'standard';
}

/**
 * Resolve the legal basis string for a category from the rate data.
 */
function getLegalBasis(category: TaxCategory): string {
  if (category === 'standard') {
    return get('vat.standard.legalBasis') as string;
  }
  if (ZERO_RATED_CATEGORIES.has(category)) {
    return get(`vat.zeroRated.${category}.legalBasis`) as string;
  }
  return get(`vat.exempt.${category}.legalBasis`) as string;
}

function getRateKey(category: TaxCategory): string {
  if (category === 'standard') {
    return 'vat.standard.rate';
  }
  if (ZERO_RATED_CATEGORIES.has(category)) {
    return `vat.zeroRated.${category}.rate`;
  }
  return `vat.exempt.${category}.rate`;
}

/**
 * Validate inputs common to all VAT operations.
 */
function validateInputs(amount: number, category: TaxCategory): void {
  assertNonNegativeFinite('amount', amount);
  if (!ALL_CATEGORIES.includes(category)) {
    throw new InvalidCategoryError(
      `Unknown VAT category "${category}"`,
      ALL_CATEGORIES,
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate VAT on an amount.
 *
 * - Exclusive (default): net = amount, vat = net × rate, gross = net + vat
 * - Inclusive: gross = amount, net = gross / (1 + rate), vat = gross − net
 *
 * All monetary values are banker's-rounded to 2dp.
 */
export function calculate(options: VatCalculateOptions): VatResult {
  const {
    amount,
    inclusive = false,
    category = 'standard',
    date,
  } = options;

  validateInputs(amount, category);

  const rateType = classifyCategory(category);
  const rate = resolveRate(category, date);
  const legalBasis = getLegalBasis(category);
  const inputVatRecoverable = rateType !== 'exempt';

  let net: number;
  let vat: number;
  let gross: number;

  if (rateType === 'zero-rated' || rateType === 'exempt') {
    // No VAT regardless of inclusive flag
    net = bankersRound(amount);
    vat = 0;
    gross = net;
  } else if (inclusive) {
    // Extract VAT from gross
    gross = bankersRound(amount);
    net = bankersRound(amount / (1 + rate));
    vat = bankersRound(gross - net);
  } else {
    // Add VAT to net
    net = bankersRound(amount);
    vat = bankersRound(net * rate);
    gross = bankersRound(net + vat);
  }

  return {
    net,
    vat,
    gross,
    rate,
    rateType,
    category,
    legalBasis,
    inputVatRecoverable,
  };
}

/**
 * Calculate VAT and return the source-backed reasoning used for the result.
 */
export function explainCalculate(options: VatCalculateOptions): CalculationExplanation<VatResult> {
  const {
    amount,
    inclusive = false,
    category = 'standard',
    date,
  } = options;
  const result = calculate({ amount, inclusive, category, date });
  const rateKeys = [getRateKey(category)];
  const { sources, warnings } = collectRateSources(rateKeys);

  const formula = result.rateType === 'standard'
    ? inclusive
      ? [
          'Gross amount is VAT-inclusive.',
          'Net amount = gross amount / (1 + rate).',
          'VAT = gross amount - net amount.',
        ]
      : [
          'Net amount is VAT-exclusive.',
          'VAT = net amount * rate.',
          'Gross amount = net amount + VAT.',
        ]
    : [
        `VAT = 0 because category "${category}" is ${result.rateType}.`,
        'Gross amount equals net amount.',
      ];

  const assumptions = [
    'Amounts are denominated in Nigerian naira.',
    "Monetary values use banker's rounding to 2 decimal places.",
  ];

  if (result.rateType === 'zero-rated') {
    assumptions.push('The category is zero-rated, so output VAT is 0 and input VAT recoverable remains true.');
  }
  if (result.rateType === 'exempt') {
    assumptions.push('The category is exempt, so output VAT is 0 and input VAT recoverable is false.');
  }
  if (date) {
    assumptions.push(`The requested date ${date} is used for rate-regime selection.`);
  }

  return {
    inputs: { amount, inclusive, category, date },
    result,
    formula,
    assumptions,
    rateKeys,
    sources,
    warnings,
  };
}

/**
 * Extract VAT from a VAT-inclusive amount.
 * Convenience alias for calculate() with inclusive=true.
 */
export function extract(options: VatCalculateOptions): VatResult {
  return calculate({ ...options, inclusive: true });
}

/**
 * Returns true if the category is subject to VAT (standard rate > 0).
 */
export function isTaxable(category: TaxCategory): boolean {
  return classifyCategory(category) === 'standard';
}

/**
 * Returns true if the category is zero-rated (0% VAT, input VAT recoverable).
 */
export function isZeroRated(category: TaxCategory): boolean {
  return classifyCategory(category) === 'zero-rated';
}

/**
 * Returns true if the category is VAT-exempt (0% VAT, input VAT NOT recoverable).
 */
export function isExempt(category: TaxCategory): boolean {
  return classifyCategory(category) === 'exempt';
}

/**
 * Get the VAT rate for a category, optionally for a specific date.
 * Pre-2026 rates use 7.5% standard; post-2026 uses the bundled rate data.
 */
export function getRate(category: TaxCategory, date?: string): number {
  return resolveRate(category, date);
}

/**
 * List all recognised VAT categories.
 */
export function listCategories(): TaxCategory[] {
  return [...ALL_CATEGORIES];
}

// ─── Rate Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the numeric VAT rate for a category, with optional date-based regime selection.
 * Pre-2026: standard rate is 7.5% (same as post-2026 in current data).
 * Post-2026: uses bundled rate data.
 */
function resolveRate(category: TaxCategory, date?: string): number {
  const rateType = classifyCategory(category);

  if (rateType === 'zero-rated' || rateType === 'exempt') {
    return 0;
  }

  // Date-based regime selection
  if (date) {
    const { year } = parseIsoDateParts(date, 'date');
    if (year < 2026) {
      // Pre-2026: VAT was 7.5% (same rate, but supports future divergence)
      return 0.075;
    }
  }

  // Post-2026 or no date: use bundled rate data
  return get('vat.standard.rate') as number;
}
