import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateTransaction } from './marketplace';
import { bankersRound } from './utils';
import type { TaxCategory } from './types';

// ─── Load shared fixtures ────────────────────────────────────────────────────
import marketplaceTestCases from '../../../shared/fixtures/marketplace_test_cases.json';

interface MarketplaceFixture {
  description: string;
  input: {
    saleAmount: number;
    platformCommission: number;
    sellerVatRegistered: boolean;
    buyerType: 'individual' | 'business';
    serviceCategory?: string;
    platformIsVatAgent?: boolean;
    paymentDate?: string;
  };
  expected: {
    saleAmount: number;
    vat: {
      net: number;
      vat: number;
      gross: number;
      rate: number;
      rateType: string;
    };
    totalFromBuyer: number;
    platformCommission: {
      rate: number;
      amount: number;
    };
    sellerPayout: number;
    wht: {
      grossAmount: number;
      rate: number;
      whtAmount: number;
      creditNoteRequired: boolean;
    } | null;
    vatLiability: {
      vatAmount: number;
      collectedBy: string;
    };
  };
}

const fixtures = marketplaceTestCases as MarketplaceFixture[];

// ─── 10.2: Unit Tests — shared fixtures ──────────────────────────────────────
// Validates: Requirements 6.1, 6.2, 6.3, 6.4

describe('Marketplace Module — shared fixture tests', () => {
  for (const tc of fixtures) {
    it(tc.description, () => {
      const result = calculateTransaction({
        saleAmount: tc.input.saleAmount,
        platformCommission: tc.input.platformCommission,
        sellerVatRegistered: tc.input.sellerVatRegistered,
        buyerType: tc.input.buyerType,
        serviceCategory: (tc.input.serviceCategory ?? 'standard') as TaxCategory,
        platformIsVatAgent: tc.input.platformIsVatAgent,
        paymentDate: tc.input.paymentDate,
      });

      // Sale amount
      expect(result.saleAmount).toBe(tc.expected.saleAmount);

      // VAT
      expect(result.vat.net).toBe(tc.expected.vat.net);
      expect(result.vat.vat).toBe(tc.expected.vat.vat);
      expect(result.vat.gross).toBe(tc.expected.vat.gross);
      expect(result.vat.rate).toBe(tc.expected.vat.rate);
      expect(result.vat.rateType).toBe(tc.expected.vat.rateType);

      // Total from buyer
      expect(result.totalFromBuyer).toBe(tc.expected.totalFromBuyer);

      // Commission
      expect(result.platformCommission.rate).toBe(tc.expected.platformCommission.rate);
      expect(result.platformCommission.amount).toBe(tc.expected.platformCommission.amount);

      // Seller payout
      expect(result.sellerPayout).toBe(tc.expected.sellerPayout);

      // WHT
      if (tc.expected.wht === null) {
        expect(result.wht).toBeNull();
      } else {
        expect(result.wht).not.toBeNull();
        expect(result.wht!.grossAmount).toBe(tc.expected.wht.grossAmount);
        expect(result.wht!.rate).toBe(tc.expected.wht.rate);
        expect(result.wht!.whtAmount).toBe(tc.expected.wht.whtAmount);
        expect(result.wht!.creditNoteRequired).toBe(tc.expected.wht.creditNoteRequired);
      }

      // VAT liability
      expect(result.vatLiability.amount).toBe(tc.expected.vatLiability.vatAmount);
      expect(result.vatLiability.collectedBy).toBe(tc.expected.vatLiability.collectedBy);

      // Balance invariant for every fixture
      const whtAmt = result.wht?.whtAmount ?? 0;
      expect(result.totalFromBuyer).toBe(
        result.sellerPayout + result.platformCommission.amount + result.vat.vat + whtAmt,
      );
    });
  }
});

describe('Marketplace Module — VAT-registered seller', () => {
  it('no WHT deducted, seller collects VAT', () => {
    const result = calculateTransaction({
      saleAmount: 100000,
      platformCommission: 0.10,
      sellerVatRegistered: true,
      buyerType: 'individual',
    });
    expect(result.wht).toBeNull();
    expect(result.vatLiability.collectedBy).toBe('seller');
    expect(result.sellerPayout).toBe(90000);
  });
});

describe('Marketplace Module — unregistered seller', () => {
  it('WHT deducted, platform collects VAT', () => {
    const result = calculateTransaction({
      saleAmount: 200000,
      platformCommission: 0.10,
      sellerVatRegistered: false,
      buyerType: 'individual',
      paymentDate: '2026-03-15',
    });
    expect(result.wht).not.toBeNull();
    expect(result.wht!.whtAmount).toBe(10000);
    expect(result.vatLiability.collectedBy).toBe('platform');
    expect(result.sellerPayout).toBe(170000);
  });
});

describe('Marketplace Module — platform as VAT agent', () => {
  it('platform collects VAT even for registered seller', () => {
    const result = calculateTransaction({
      saleAmount: 300000,
      platformCommission: 0.12,
      sellerVatRegistered: true,
      buyerType: 'business',
      platformIsVatAgent: true,
    });
    expect(result.vatLiability.collectedBy).toBe('platform');
    expect(result.wht).toBeNull();
    expect(result.sellerPayout).toBe(264000);
  });
});

// ─── 10.3: Property-Based Test — Marketplace balance invariant ───────────────
// **Validates: Requirements 6.5, 35.4**

describe('Marketplace Module — Property: balance invariant', () => {
  it('Property 4: For all valid marketplace transactions, totalFromBuyer === sellerPayout + commission + VAT + WHT', () => {
    const categoryArb = fc.constantFrom<TaxCategory>(
      'standard',
      'basic-food',
      'medicine',
      'residential-rent',
    );

    fc.assert(
      fc.property(
        fc.record({
          saleAmount: fc.integer({ min: 1, max: 100_000_000 }),
          commissionRate: fc.integer({ min: 1, max: 50 }).map((n) => n / 100),
          sellerVatRegistered: fc.boolean(),
          category: categoryArb,
          platformIsVatAgent: fc.boolean(),
        }),
        ({ saleAmount, commissionRate, sellerVatRegistered, category, platformIsVatAgent }) => {
          const result = calculateTransaction({
            saleAmount,
            platformCommission: commissionRate,
            sellerVatRegistered,
            buyerType: 'individual',
            serviceCategory: category,
            platformIsVatAgent,
          });

          const whtAmount = result.wht?.whtAmount ?? 0;
          const sum = bankersRound(
            result.sellerPayout + result.platformCommission.amount + result.vat.vat + whtAmount,
          );

          expect(sum).toBe(result.totalFromBuyer);
        },
      ),
      { numRuns: 500 },
    );
  });
});
