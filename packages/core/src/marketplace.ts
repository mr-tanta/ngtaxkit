// ─── Marketplace Module ──────────────────────────────────────────────────────
// Pure-function marketplace transaction calculator.
// Delegates to VAT and WHT modules, computes commission, seller payout, and
// ensures the balance invariant: totalFromBuyer = sellerPayout + commission + VAT + WHT.

import type {
  MarketplaceOptions,
  MarketplaceResult,
  TaxCategory,
} from './types';
import * as vat from './vat';
import * as wht from './wht';
import { bankersRound } from './utils';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate the full tax breakdown for a marketplace buyer-seller transaction.
 *
 * 1. VAT is calculated on the full saleAmount (not just commission).
 * 2. totalFromBuyer = saleAmount + vatAmount.
 * 3. commissionAmount = bankersRound(saleAmount × platformCommission).
 * 4. If seller is NOT VAT-registered, WHT is deducted from the seller payout
 *    at the professional/individual rate (5%).
 * 5. sellerPayout = saleAmount − commissionAmount − whtAmount.
 * 6. VAT liability: collected by seller if VAT-registered and platform is NOT
 *    acting as VAT agent; otherwise collected by platform.
 *
 * Balance invariant: totalFromBuyer === sellerPayout + commissionAmount + vatAmount + whtAmount
 */
export function calculateTransaction(options: MarketplaceOptions & { paymentDate?: string }): MarketplaceResult {
  const {
    saleAmount,
    platformCommission: commissionRate,
    sellerVatRegistered,
    serviceCategory = 'standard' as TaxCategory,
    platformIsVatAgent = false,
    paymentDate,
  } = options;

  // 1. Calculate VAT on the full sale amount
  const vatResult = vat.calculate({ amount: saleAmount, category: serviceCategory });
  const vatAmount = vatResult.vat;

  // 2. Total charged to buyer
  const totalFromBuyer = vatResult.gross;

  // 3. Platform commission on the sale amount (pre-VAT)
  const commissionAmount = bankersRound(saleAmount * commissionRate);

  // 4. WHT: only when seller is NOT VAT-registered
  let whtResult = null;
  let whtAmount = 0;
  if (!sellerVatRegistered) {
    whtResult = wht.calculate({
      amount: saleAmount,
      serviceType: 'professional',
      payeeType: 'individual',
      paymentDate,
    });
    whtAmount = whtResult.whtAmount;
  }

  // 5. Seller payout — computed as residual to guarantee the balance invariant:
  //    totalFromBuyer = sellerPayout + commissionAmount + vatAmount + whtAmount
  //    Mathematically: saleAmount - commissionAmount - whtAmount
  const sellerPayout = bankersRound(totalFromBuyer - commissionAmount - vatAmount - whtAmount);

  // 6. VAT liability assignment
  const vatCollectedBy: 'seller' | 'platform' =
    sellerVatRegistered && !platformIsVatAgent ? 'seller' : 'platform';

  return {
    saleAmount,
    vat: vatResult,
    totalFromBuyer,
    platformCommission: {
      rate: commissionRate,
      amount: commissionAmount,
      vatOnCommission: 0,
      netCommission: commissionAmount,
    },
    sellerPayout,
    wht: whtResult
      ? {
          grossAmount: whtResult.grossAmount,
          rate: whtResult.rate,
          whtAmount: whtResult.whtAmount,
          netPayment: whtResult.netPayment,
          exempt: whtResult.exempt,
          exemptionBasis: whtResult.exemptionBasis,
          remittanceDeadline: whtResult.remittanceDeadline,
          creditNoteRequired: whtResult.creditNoteRequired,
          legalBasis: whtResult.legalBasis,
        }
      : null,
    vatLiability: {
      collectedBy: vatCollectedBy,
      amount: vatAmount,
      remittedBy: vatCollectedBy,
    },
    breakdown: {
      saleAmount,
      vatAmount,
      commissionAmount,
      whtAmount,
      sellerPayout,
      totalFromBuyer,
    },
  };
}
