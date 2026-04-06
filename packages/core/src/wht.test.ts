import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as wht from './wht';
import { InvalidServiceTypeError } from './errors';
import type { WhtServiceType } from './types';
import testCases from '../../../shared/fixtures/wht_test_cases.json';

// ─── 7.2: Unit Tests — Shared Fixtures ──────────────────────────────────────

describe('WHT Module — shared fixtures', () => {
  for (const tc of testCases) {
    if ('expectedError' in tc) {
      it(tc.description, () => {
        expect(() =>
          wht.calculate({
            amount: tc.input.amount,
            payeeType: tc.input.payeeType as 'individual' | 'company',
            serviceType: tc.input.serviceType as WhtServiceType,
            payeeIsSmallCompany: (tc.input as Record<string, unknown>).payeeIsSmallCompany as boolean | undefined,
            paymentDate: tc.input.paymentDate,
          }),
        ).toThrow(InvalidServiceTypeError);
      });
    } else {
      it(tc.description, () => {
        const result = wht.calculate({
          amount: tc.input.amount,
          payeeType: tc.input.payeeType as 'individual' | 'company',
          serviceType: tc.input.serviceType as WhtServiceType,
          payeeIsSmallCompany: (tc.input as Record<string, unknown>).payeeIsSmallCompany as boolean | undefined,
          paymentDate: tc.input.paymentDate,
        });

        expect(result.grossAmount).toBe(tc.expected!.grossAmount);
        expect(result.rate).toBe(tc.expected!.rate);
        expect(result.whtAmount).toBe(tc.expected!.whtAmount);
        expect(result.netPayment).toBe(tc.expected!.netPayment);
        expect(result.exempt).toBe(tc.expected!.exempt);
        expect(result.creditNoteRequired).toBe(tc.expected!.creditNoteRequired);
        expect(result.remittanceDeadline).toBe(tc.expected!.remittanceDeadline);

        if (tc.expected!.exemptionBasis !== undefined) {
          expect(result.exemptionBasis).toBe(tc.expected!.exemptionBasis);
        }
      });
    }
  }
});

// ─── 7.2: Individual vs Company rates ───────────────────────────────────────

describe('WHT Module — individual vs company rates', () => {
  const serviceTypes = wht.listServiceTypes();

  for (const st of serviceTypes) {
    it(`getRate("${st}", "individual") returns a number`, () => {
      const rate = wht.getRate(st, 'individual');
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });

    it(`getRate("${st}", "company") returns a number`, () => {
      const rate = wht.getRate(st, 'company');
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  }
});

// ─── 7.2: Small company exemption boundary ──────────────────────────────────

describe('WHT Module — small company exemption boundary', () => {
  it('exempt at exactly ₦2,000,000', () => {
    const result = wht.calculate({
      amount: 2_000_000,
      payeeType: 'company',
      serviceType: 'professional',
      payeeIsSmallCompany: true,
      paymentDate: '2026-06-15',
    });
    expect(result.exempt).toBe(true);
    expect(result.whtAmount).toBe(0);
    expect(result.creditNoteRequired).toBe(false);
  });

  it('NOT exempt at ₦2,000,001', () => {
    const result = wht.calculate({
      amount: 2_000_001,
      payeeType: 'company',
      serviceType: 'professional',
      payeeIsSmallCompany: true,
      paymentDate: '2026-06-15',
    });
    expect(result.exempt).toBe(false);
    expect(result.whtAmount).toBeGreaterThan(0);
    expect(result.creditNoteRequired).toBe(true);
  });

  it('non-small company is NOT exempt even at ₦1,000,000', () => {
    const result = wht.calculate({
      amount: 1_000_000,
      payeeType: 'company',
      serviceType: 'professional',
      payeeIsSmallCompany: false,
      paymentDate: '2026-06-15',
    });
    expect(result.exempt).toBe(false);
    expect(result.whtAmount).toBeGreaterThan(0);
  });
});

// ─── 7.2: listServiceTypes ──────────────────────────────────────────────────

describe('WHT Module — listServiceTypes', () => {
  it('returns all 11 service types', () => {
    const types = wht.listServiceTypes();
    expect(types).toHaveLength(11);
    expect(types).toContain('professional');
    expect(types).toContain('dividend');
    expect(types).toContain('interest');
  });
});

// ─── 7.2: Invalid service type ──────────────────────────────────────────────

describe('WHT Module — error handling', () => {
  it('throws InvalidServiceTypeError for unknown service type', () => {
    expect(() =>
      wht.calculate({
        amount: 100_000,
        payeeType: 'individual',
        serviceType: 'gambling' as WhtServiceType,
        paymentDate: '2026-01-15',
      }),
    ).toThrow(InvalidServiceTypeError);
  });

  it('InvalidServiceTypeError includes valid service types', () => {
    try {
      wht.calculate({
        amount: 100_000,
        payeeType: 'individual',
        serviceType: 'gambling' as WhtServiceType,
        paymentDate: '2026-01-15',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidServiceTypeError);
      expect((e as InvalidServiceTypeError).validServiceTypes).toHaveLength(11);
    }
  });
});


// ─── 7.3: Property Test — WHT gross = net + wht ─────────────────────────────
// **Validates: Requirements 3.1, 35.3**

import { bankersRound } from './utils';

const SERVICE_TYPES: WhtServiceType[] = [
  'professional', 'management', 'technical', 'consultancy', 'commission',
  'construction', 'contract', 'rent', 'royalty', 'dividend', 'interest',
];

describe('WHT Module — Property 3: grossAmount === netPayment + whtAmount', () => {
  it('Property 3: For all valid WHT inputs, grossAmount === netPayment + whtAmount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000_000 }).map(n => n / 100),
        fc.constantFrom<'individual' | 'company'>('individual', 'company'),
        fc.constantFrom<WhtServiceType>(...SERVICE_TYPES),
        fc.boolean(),
        (amount, payeeType, serviceType, payeeIsSmallCompany) => {
          const result = wht.calculate({
            amount,
            payeeType,
            serviceType,
            payeeIsSmallCompany,
            paymentDate: '2026-06-15',
          });

          // The invariant: gross = net + wht (rounded to 2dp to handle floating-point addition)
          expect(bankersRound(result.netPayment + result.whtAmount)).toBe(result.grossAmount);
        },
      ),
      { numRuns: 500 },
    );
  });
});
