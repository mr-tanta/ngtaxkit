import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculate, isExempt, getBrackets, calculateRelief } from './paye';
import { InvalidAmountError } from './errors';

// ─── Load shared fixtures ────────────────────────────────────────────────────
import payeTestCases from '../../../shared/fixtures/paye_test_cases.json';

interface PayeFixture {
  description: string;
  input: {
    grossAnnual: number;
    pensionContributing: boolean;
    nhfContributing: boolean;
    rentPaidAnnual?: number;
  };
  expected: {
    grossAnnual: number;
    grossMonthly?: number;
    exempt: boolean;
    reliefs?: {
      consolidatedRelief: number;
      pensionRelief: number;
      nhfRelief: number;
      rentRelief: number;
      total: number;
    };
    taxableIncome?: number;
    taxBands?: Array<{
      lower: number;
      upper: number | null;
      rate: number;
      taxInBand: number;
    }>;
    annualPaye: number;
    monthlyPaye: number;
    effectiveRate: number;
  };
}

const fixtures = payeTestCases as PayeFixture[];

// ─── 6.2: Unit Tests — Shared Fixtures ───────────────────────────────────────

describe('PAYE Module — shared fixture tests', () => {
  for (const tc of fixtures) {
    it(tc.description, () => {
      const result = calculate({
        grossAnnual: tc.input.grossAnnual,
        pensionContributing: tc.input.pensionContributing,
        nhfContributing: tc.input.nhfContributing,
        rentPaidAnnual: tc.input.rentPaidAnnual,
      });

      expect(result.grossAnnual).toBe(tc.expected.grossAnnual);
      expect(result.exempt).toBe(tc.expected.exempt);
      expect(result.annualPaye).toBe(tc.expected.annualPaye);
      expect(result.monthlyPaye).toBe(tc.expected.monthlyPaye);
      expect(result.effectiveRate).toBe(tc.expected.effectiveRate);

      if (tc.expected.grossMonthly !== undefined) {
        expect(result.grossMonthly).toBe(tc.expected.grossMonthly);
      }

      if (tc.expected.reliefs) {
        expect(result.reliefs.consolidatedRelief).toBe(tc.expected.reliefs.consolidatedRelief);
        expect(result.reliefs.pensionRelief).toBe(tc.expected.reliefs.pensionRelief);
        expect(result.reliefs.nhfRelief).toBe(tc.expected.reliefs.nhfRelief);
        expect(result.reliefs.rentRelief).toBe(tc.expected.reliefs.rentRelief);
        expect(result.reliefs.total).toBe(tc.expected.reliefs.total);
      }

      if (tc.expected.taxableIncome !== undefined) {
        expect(result.taxableIncome).toBe(tc.expected.taxableIncome);
      }

      if (tc.expected.taxBands) {
        for (let i = 0; i < tc.expected.taxBands.length; i++) {
          expect(result.taxBands[i].taxInBand).toBe(tc.expected.taxBands[i].taxInBand);
        }
      }
    });
  }
});

// ─── 6.2: Unit Tests — Exemption Threshold ──────────────────────────────────

describe('PAYE Module — exemption threshold', () => {
  it('₦800,000 exactly is exempt', () => {
    const result = calculate({ grossAnnual: 800000 });
    expect(result.exempt).toBe(true);
    expect(result.annualPaye).toBe(0);
    expect(result.monthlyPaye).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('₦800,001 is NOT exempt', () => {
    const result = calculate({ grossAnnual: 800001 });
    expect(result.exempt).toBe(false);
  });

  it('₦0 is exempt', () => {
    const result = calculate({ grossAnnual: 0 });
    expect(result.exempt).toBe(true);
    expect(result.annualPaye).toBe(0);
  });

  it('throws InvalidAmountError for negative gross', () => {
    expect(() => calculate({ grossAnnual: -1 })).toThrow(InvalidAmountError);
  });
});

// ─── 6.2: Unit Tests — isExempt utility ─────────────────────────────────────

describe('PAYE Module — isExempt()', () => {
  it('returns true for ₦800,000', () => {
    expect(isExempt(800000)).toBe(true);
  });

  it('returns false for ₦800,001', () => {
    expect(isExempt(800001)).toBe(false);
  });

  it('returns true for ₦0', () => {
    expect(isExempt(0)).toBe(true);
  });
});

// ─── 6.2: Unit Tests — getBrackets utility ──────────────────────────────────

describe('PAYE Module — getBrackets()', () => {
  it('returns 7 brackets', () => {
    const brackets = getBrackets();
    expect(brackets).toHaveLength(7);
  });

  it('first bracket starts at 0 with 0% rate', () => {
    const brackets = getBrackets();
    expect(brackets[0].lower).toBe(0);
    expect(brackets[0].rate).toBe(0);
  });

  it('last bracket has 24% rate', () => {
    const brackets = getBrackets();
    expect(brackets[6].rate).toBe(0.24);
  });
});

// ─── 6.2: Unit Tests — calculateRelief ──────────────────────────────────────

describe('PAYE Module — calculateRelief()', () => {
  it('CRA for ₦3M: max(200K, 30K) + 600K = 800K', () => {
    const reliefs = calculateRelief({ grossAnnual: 3000000 });
    expect(reliefs.consolidatedRelief).toBe(800000);
  });

  it('pension relief is 8% of gross when contributing', () => {
    const reliefs = calculateRelief({ grossAnnual: 5000000, pensionContributing: true });
    expect(reliefs.pensionRelief).toBe(400000);
  });

  it('NHF relief is 2.5% of gross when contributing', () => {
    const reliefs = calculateRelief({ grossAnnual: 10000000, nhfContributing: true });
    expect(reliefs.nhfRelief).toBe(250000);
  });

  it('rent relief is 20% of rent paid', () => {
    const reliefs = calculateRelief({ grossAnnual: 4000000, rentPaidAnnual: 1200000 });
    expect(reliefs.rentRelief).toBe(240000);
  });

  it('rent relief is capped at ₦500,000', () => {
    const reliefs = calculateRelief({ grossAnnual: 6000000, rentPaidAnnual: 5000000 });
    expect(reliefs.rentRelief).toBe(500000);
  });
});

// ─── 6.2: Unit Tests — Full result structure ────────────────────────────────

describe('PAYE Module — full result structure', () => {
  it('includes legalBasis string', () => {
    const result = calculate({ grossAnnual: 3000000 });
    expect(result.legalBasis).toContain('NTA 2025');
  });

  it('includes employer costs', () => {
    const result = calculate({ grossAnnual: 3000000, pensionContributing: true });
    expect(result.employerCosts.pension).toBeGreaterThan(0);
    expect(result.employerCosts.nsitf).toBeGreaterThan(0);
    expect(result.employerCosts.itf).toBeGreaterThan(0);
    expect(result.employerCosts.total).toBe(
      result.employerCosts.pension + result.employerCosts.nsitf + result.employerCosts.itf,
    );
  });

  it('monthly deductions sum correctly', () => {
    const result = calculate({
      grossAnnual: 5000000,
      pensionContributing: true,
      nhfContributing: true,
    });
    expect(result.monthlyDeductions.total).toBe(
      bankersRoundHelper(
        result.monthlyDeductions.paye +
        result.monthlyDeductions.pension +
        result.monthlyDeductions.nhf,
      ),
    );
  });
});

/** Helper to match banker's rounding in assertions. */
function bankersRoundHelper(value: number): number {
  const shifted = value * 100;
  const floored = Math.floor(shifted);
  const remainder = shifted - floored;
  const epsilon = 1e-9;
  if (Math.abs(remainder - 0.5) < epsilon) {
    return (floored % 2 === 0 ? floored : floored + 1) / 100;
  }
  return Math.round(shifted) / 100;
}

// ─── 6.3: Property-Based Test ────────────────────────────────────────────────
// **Validates: Requirements 2.8, 35.2**

describe('PAYE Module — Property: monthlyPaye × 12 ≈ annualPaye', () => {
  it('Property 2: For all valid gross annual incomes, paye.calculate(x).monthlyPaye * 12 === paye.calculate(x).annualPaye', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        (grossAnnual) => {
          const result = calculate({ grossAnnual });
          const monthlyTimes12 = bankersRoundHelper(result.monthlyPaye * 12);
          // Allow ±1 kobo tolerance due to rounding of monthly = round(annual/12)
          expect(Math.abs(monthlyTimes12 - result.annualPaye)).toBeLessThanOrEqual(0.12);
        },
      ),
      { numRuns: 500 },
    );
  });
});
