// ─── PAYE Module ─────────────────────────────────────────────────────────────
// Pure-function PAYE (Pay-As-You-Earn) calculation engine per NTA 2025.
// Zero dependencies, deterministic output, banker's rounding on all monetary values.

import type {
  PayeCalculateOptions,
  PayeResult,
  TaxBand,
  ReliefBreakdown,
  MonthlyDeductions,
  EmployerCosts,
} from './types';
import { InvalidAmountError } from './errors';
import { bankersRound } from './utils';
import { get, type RateValue } from './rates';

// ─── Internal Types ──────────────────────────────────────────────────────────

interface RateBand {
  lower: number;
  upper: number | null;
  rate: number;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** Load PAYE brackets from the rates registry. */
function loadBrackets(): RateBand[] {
  const bands = get('paye.bands') as RateValue[];
  return bands.map((b) => {
    const band = b as Record<string, RateValue>;
    return {
      lower: band.lower as number,
      upper: band.upper as number | null,
      rate: band.rate as number,
    };
  });
}

/** Apply graduated tax bands to taxable income and return per-band breakdown. */
function applyBands(taxableIncome: number, brackets: RateBand[]): TaxBand[] {
  return brackets.map((band) => {
    const upper = band.upper ?? Infinity;
    const incomeInBand = Math.max(0, Math.min(taxableIncome, upper) - band.lower);
    const taxInBand = bankersRound(incomeInBand * band.rate);
    return {
      lower: band.lower,
      upper: band.upper ?? Infinity,
      rate: band.rate,
      taxInBand,
    };
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate PAYE for a given gross annual income.
 *
 * Steps:
 * 1. Check exemption threshold (₦800,000)
 * 2. Calculate CRA: max(₦200K, 1% of gross) + 20% of gross
 * 3. Calculate pension relief (8% if contributing)
 * 4. Calculate NHF relief (2.5% if contributing)
 * 5. Calculate rent relief (20% of rent paid, capped at ₦500K)
 * 6. Taxable income = gross - total reliefs
 * 7. Apply 7-band graduated rates
 * 8. Compute monthly, effective rate, net monthly, deductions, employer costs
 */
export function calculate(options: PayeCalculateOptions): PayeResult {
  const {
    grossAnnual,
    pensionContributing = false,
    nhfContributing = false,
    rentPaidAnnual = 0,
  } = options;

  if (grossAnnual < 0) {
    throw new InvalidAmountError(
      `Gross annual income must be non-negative, received ${grossAnnual}`,
    );
  }

  const exemptionThreshold = get('paye.exemptionThreshold') as number;
  const legalBasis = get('paye.legalBasis') as string;
  const brackets = loadBrackets();

  // ── Exemption check ──
  if (grossAnnual <= exemptionThreshold) {
    const grossMonthly = bankersRound(grossAnnual / 12);
    return {
      grossAnnual,
      grossMonthly,
      pension: { employee: 0, employer: 0 },
      nhf: 0,
      reliefs: {
        consolidatedRelief: 0,
        rentRelief: 0,
        pensionRelief: 0,
        nhfRelief: 0,
        total: 0,
      },
      taxableIncome: 0,
      taxBands: applyBands(0, brackets),
      annualPaye: 0,
      monthlyPaye: 0,
      effectiveRate: 0,
      exempt: true,
      exemptionBasis: get('paye.exemptionBasis') as string,
      netMonthly: grossMonthly,
      monthlyDeductions: { paye: 0, pension: 0, nhf: 0, total: 0 },
      employerCosts: { pension: 0, nsitf: 0, itf: 0, total: 0 },
      legalBasis,
    };
  }

  // ── Reliefs ──
  const reliefs = calculateRelief(options);

  // ── Taxable income ──
  const taxableIncome = bankersRound(Math.max(0, grossAnnual - reliefs.total));

  // ── Apply graduated bands ──
  const taxBands = applyBands(taxableIncome, brackets);
  const annualPaye = bankersRound(taxBands.reduce((sum, b) => sum + b.taxInBand, 0));

  // ── Monthly values ──
  const grossMonthly = bankersRound(grossAnnual / 12);
  const monthlyPaye = bankersRound(annualPaye / 12);

  // ── Effective rate (4dp) ──
  const effectiveRate = grossAnnual > 0
    ? Math.round((annualPaye / grossAnnual) * 10000) / 10000
    : 0;

  // ── Pension & NHF amounts ──
  const employeePension = pensionContributing
    ? bankersRound(grossAnnual * (get('pension.minimumRates.employee') as number))
    : 0;
  const employerPension = pensionContributing
    ? bankersRound(grossAnnual * (get('pension.minimumRates.employer') as number))
    : 0;
  const nhfAmount = nhfContributing
    ? bankersRound(grossAnnual * (get('statutory.nhf.rate') as number))
    : 0;

  // ── Monthly deductions ──
  const monthlyEmployeePension = bankersRound(employeePension / 12);
  const monthlyNhf = bankersRound(nhfAmount / 12);
  const totalMonthlyDeductions = bankersRound(monthlyPaye + monthlyEmployeePension + monthlyNhf);
  const monthlyDeductions: MonthlyDeductions = {
    paye: monthlyPaye,
    pension: monthlyEmployeePension,
    nhf: monthlyNhf,
    total: totalMonthlyDeductions,
  };

  // ── Net monthly ──
  const netMonthly = bankersRound(grossMonthly - totalMonthlyDeductions);

  // ── Employer costs ──
  const monthlyEmployerPension = bankersRound(employerPension / 12);
  const nsitfRate = get('statutory.nsitf.rate') as number;
  const itfRate = get('statutory.itf.rate') as number;
  const monthlyNsitf = bankersRound(grossMonthly * nsitfRate);
  const monthlyItf = bankersRound(grossMonthly * itfRate);
  const employerCosts: EmployerCosts = {
    pension: monthlyEmployerPension,
    nsitf: monthlyNsitf,
    itf: monthlyItf,
    total: bankersRound(monthlyEmployerPension + monthlyNsitf + monthlyItf),
  };

  return {
    grossAnnual,
    grossMonthly,
    pension: { employee: employeePension, employer: employerPension },
    nhf: nhfAmount,
    reliefs,
    taxableIncome,
    taxBands,
    annualPaye,
    monthlyPaye,
    effectiveRate,
    exempt: false,
    exemptionBasis: null,
    netMonthly,
    monthlyDeductions,
    employerCosts,
    legalBasis,
  };
}

/**
 * Check if a gross annual income is exempt from PAYE.
 * Income at or below ₦800,000 is exempt per NTA 2025.
 */
export function isExempt(grossAnnual: number, _taxYear?: number): boolean {
  const threshold = get('paye.exemptionThreshold') as number;
  return grossAnnual <= threshold;
}

/**
 * Get the PAYE graduated tax brackets for a given tax year.
 */
export function getBrackets(_taxYear?: number): RateBand[] {
  return loadBrackets();
}

/**
 * Calculate all PAYE reliefs for the given options.
 */
export function calculateRelief(options: PayeCalculateOptions): ReliefBreakdown {
  const {
    grossAnnual,
    pensionContributing = false,
    nhfContributing = false,
    rentPaidAnnual = 0,
  } = options;

  // CRA: max(₦200K, 1% of gross) + 20% of gross
  const craFixed = get('paye.cra.fixedAmount') as number;
  const craPercent = get('paye.cra.percentOfGross') as number;
  const craAdditional = get('paye.cra.additionalPercentOfGross') as number;
  const consolidatedRelief = bankersRound(
    Math.max(craFixed, grossAnnual * craPercent) + grossAnnual * craAdditional,
  );

  // Pension relief: 8% of gross (if contributing)
  const pensionRelief = pensionContributing
    ? bankersRound(grossAnnual * (get('pension.minimumRates.employee') as number))
    : 0;

  // NHF relief: 2.5% of gross (if contributing)
  const nhfRelief = nhfContributing
    ? bankersRound(grossAnnual * (get('statutory.nhf.rate') as number))
    : 0;

  // Rent relief: 20% of rent paid, capped at ₦500K
  const rentReliefRate = get('paye.rentRelief.rate') as number;
  const rentReliefCap = get('paye.rentRelief.cap') as number;
  const rentRelief = rentPaidAnnual > 0
    ? bankersRound(Math.min(rentPaidAnnual * rentReliefRate, rentReliefCap))
    : 0;

  const total = bankersRound(consolidatedRelief + pensionRelief + nhfRelief + rentRelief);

  return {
    consolidatedRelief,
    rentRelief,
    pensionRelief,
    nhfRelief,
    total,
  };
}
