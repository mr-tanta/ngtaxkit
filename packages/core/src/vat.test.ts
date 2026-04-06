import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculate, extract, isTaxable, isZeroRated, isExempt, getRate, listCategories } from './vat';
import { InvalidAmountError, InvalidCategoryError } from './errors';
import type { TaxCategory } from './types';

// ─── Load shared fixtures ────────────────────────────────────────────────────
import vatTestCases from '../../../shared/fixtures/vat_test_cases.json';

interface VatFixture {
  description: string;
  input: {
    amount: number;
    category?: string;
    inclusive?: boolean;
    date?: string;
  };
  expected?: {
    net: number;
    vat: number;
    gross: number;
    rate: number;
    rateType: string;
    category: string;
    inputVatRecoverable: boolean;
  };
  expectedError?: {
    code: string;
  };
}

const fixtures = vatTestCases as VatFixture[];

// ─── 5.2: Unit Tests ─────────────────────────────────────────────────────────

describe('VAT Module — shared fixture tests', () => {
  for (const tc of fixtures) {
    it(tc.description, () => {
      const opts = {
        amount: tc.input.amount,
        category: tc.input.category as TaxCategory | undefined,
        inclusive: tc.input.inclusive,
        date: tc.input.date,
      };

      if (tc.expectedError) {
        if (tc.expectedError.code === 'NGTK_INVALID_AMOUNT') {
          expect(() => calculate(opts)).toThrow(InvalidAmountError);
        } else if (tc.expectedError.code === 'NGTK_INVALID_CATEGORY') {
          expect(() => calculate(opts)).toThrow(InvalidCategoryError);
        }
      } else {
        const result = calculate(opts);
        expect(result.net).toBe(tc.expected!.net);
        expect(result.vat).toBe(tc.expected!.vat);
        expect(result.gross).toBe(tc.expected!.gross);
        expect(result.rate).toBe(tc.expected!.rate);
        expect(result.rateType).toBe(tc.expected!.rateType);
        expect(result.category).toBe(tc.expected!.category);
        expect(result.inputVatRecoverable).toBe(tc.expected!.inputVatRecoverable);
      }
    });
  }
});

describe('VAT Module — standard category', () => {
  it('calculates 7.5% VAT on ₦10,000', () => {
    const result = calculate({ amount: 10000, category: 'standard' });
    expect(result.net).toBe(10000);
    expect(result.vat).toBe(750);
    expect(result.gross).toBe(10750);
    expect(result.rate).toBe(0.075);
    expect(result.rateType).toBe('standard');
    expect(result.inputVatRecoverable).toBe(true);
    expect(result.legalBasis).toContain('NTA 2025');
  });
});

describe('VAT Module — zero-rated categories', () => {
  const zeroRated: TaxCategory[] = [
    'basic-food', 'medicine', 'medical-equipment', 'medical-services',
    'educational-books', 'tuition', 'electricity', 'export-services', 'humanitarian-goods',
  ];

  for (const cat of zeroRated) {
    it(`${cat} has zero VAT and is input-VAT recoverable`, () => {
      const result = calculate({ amount: 5000, category: cat });
      expect(result.vat).toBe(0);
      expect(result.rate).toBe(0);
      expect(result.rateType).toBe('zero-rated');
      expect(result.inputVatRecoverable).toBe(true);
    });
  }
});

describe('VAT Module — exempt categories', () => {
  const exempt: TaxCategory[] = [
    'residential-rent', 'public-transport', 'financial-services', 'insurance',
  ];

  for (const cat of exempt) {
    it(`${cat} has zero VAT and is NOT input-VAT recoverable`, () => {
      const result = calculate({ amount: 5000, category: cat });
      expect(result.vat).toBe(0);
      expect(result.rate).toBe(0);
      expect(result.rateType).toBe('exempt');
      expect(result.inputVatRecoverable).toBe(false);
    });
  }
});

describe('VAT Module — inclusive extraction', () => {
  it('extracts VAT from ₦10,750 inclusive', () => {
    const result = calculate({ amount: 10750, inclusive: true, category: 'standard' });
    expect(result.net).toBe(10000);
    expect(result.vat).toBe(750);
    expect(result.gross).toBe(10750);
  });

  it('extract() is an alias for calculate with inclusive=true', () => {
    const result = extract({ amount: 10750, category: 'standard' });
    expect(result.net).toBe(10000);
    expect(result.vat).toBe(750);
    expect(result.gross).toBe(10750);
  });
});

describe('VAT Module — error cases', () => {
  it('throws InvalidAmountError for negative amount', () => {
    expect(() => calculate({ amount: -100, category: 'standard' })).toThrow(InvalidAmountError);
  });

  it('throws InvalidCategoryError for unknown category', () => {
    expect(() => calculate({ amount: 1000, category: 'luxury-goods' as TaxCategory })).toThrow(InvalidCategoryError);
  });

  it('InvalidCategoryError includes valid categories', () => {
    try {
      calculate({ amount: 1000, category: 'luxury-goods' as TaxCategory });
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidCategoryError);
      expect((e as InvalidCategoryError).validCategories.length).toBeGreaterThan(0);
      expect((e as InvalidCategoryError).validCategories).toContain('standard');
    }
  });
});

describe('VAT Module — utility functions', () => {
  it('isTaxable returns true for standard', () => {
    expect(isTaxable('standard')).toBe(true);
  });

  it('isTaxable returns false for zero-rated', () => {
    expect(isTaxable('basic-food')).toBe(false);
  });

  it('isZeroRated returns true for medicine', () => {
    expect(isZeroRated('medicine')).toBe(true);
  });

  it('isExempt returns true for insurance', () => {
    expect(isExempt('insurance')).toBe(true);
  });

  it('getRate returns 0.075 for standard', () => {
    expect(getRate('standard')).toBe(0.075);
  });

  it('getRate returns 0 for zero-rated', () => {
    expect(getRate('basic-food')).toBe(0);
  });

  it('listCategories returns all categories', () => {
    const cats = listCategories();
    expect(cats).toContain('standard');
    expect(cats).toContain('basic-food');
    expect(cats).toContain('insurance');
    expect(cats.length).toBe(14);
  });
});

describe('VAT Module — date-based rate regime', () => {
  it('uses 7.5% for pre-2026 date', () => {
    const result = calculate({ amount: 10000, category: 'standard', date: '2025-06-15' });
    expect(result.rate).toBe(0.075);
  });

  it('uses bundled rate for post-2026 date', () => {
    const result = calculate({ amount: 10000, category: 'standard', date: '2026-06-15' });
    expect(result.rate).toBe(0.075);
  });
});


// ─── 5.3: Property-Based Test ────────────────────────────────────────────────
// **Validates: Requirements 1.1, 35.1**

describe('VAT Module — Property: net + vat === gross', () => {
  it('Property 1: For all non-negative amounts, calculate(x).net + calculate(x).vat === calculate(x).gross', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
        (amount) => {
          // Skip Infinity
          if (!Number.isFinite(amount)) return;

          const result = calculate({ amount, category: 'standard' });
          const sum = Math.round((result.net + result.vat) * 100) / 100;
          expect(sum).toBe(result.gross);
        },
      ),
      { numRuns: 500 },
    );
  });
});
