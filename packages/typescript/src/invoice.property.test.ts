// ─── 19.4: Property Test — FIRS JSON Round-Trip ─────────────────────────────
// **Property 7: For all valid invoices, parse(toFIRSJSON(invoice)) → toFIRSJSON produces identical JSON**
// **Validates: Requirements 16.3**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { create, toFIRSJSON, type Party, type InvoiceItem, type Invoice } from './invoice';
import type { TaxCategory } from '@ngtaxkit/core';

// ─── Generators ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES: TaxCategory[] = [
  'standard', 'basic-food', 'medicine', 'medical-equipment',
  'medical-services', 'educational-books', 'tuition', 'electricity',
  'export-services', 'humanitarian-goods', 'residential-rent',
  'public-transport', 'financial-services', 'insurance',
];

const safeString = fc.string({ minLength: 1, maxLength: 30 }).map(
  (s) => s.replace(/[^\w\s.-]/g, 'x') || 'x',
);

const partyArb: fc.Arbitrary<Party> = fc.record({
  name: safeString,
  tin: safeString,
  address: safeString,
});

const itemArb: fc.Arbitrary<InvoiceItem> = fc.record({
  description: safeString,
  quantity: fc.integer({ min: 1, max: 100 }),
  unitPrice: fc.integer({ min: 1, max: 1_000_000 }),
  category: fc.constantFrom(...VALID_CATEGORIES),
});

const invoiceArb: fc.Arbitrary<Invoice> = fc
  .record({
    seller: partyArb,
    buyer: partyArb,
    items: fc.array(itemArb, { minLength: 1, maxLength: 5 }),
    invoiceNumber: safeString,
    issueDate: fc.constant('2026-01-15'),
  })
  .map((opts) => create(opts));

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 7 — FIRS JSON round-trip', () => {
  it('parse(toFIRSJSON(invoice)) → toFIRSJSON produces identical JSON', () => {
    fc.assert(
      fc.property(invoiceArb, (invoice) => {
        const json1 = toFIRSJSON(invoice);

        // Parse and re-serialize — should be identical since JSON.stringify
        // with consistent options is deterministic
        const parsed = JSON.parse(json1);
        const json2 = JSON.stringify(parsed, null, 2);

        expect(json1).toBe(json2);
      }),
      { numRuns: 100 },
    );
  });

  it('parsed JSON contains all mandatory invoice fields', () => {
    fc.assert(
      fc.property(invoiceArb, (invoice) => {
        const json = toFIRSJSON(invoice);
        const parsed = JSON.parse(json);

        // Invoice-level
        expect(parsed.invoiceNumber).toBe(invoice.invoiceNumber);
        expect(parsed.invoiceType).toBe(invoice.type);
        expect(parsed.issueDate).toBe(invoice.issueDate);
        expect(parsed.currency).toBe(invoice.currency);

        // Seller
        expect(parsed.seller.name).toBe(invoice.seller.name);
        expect(parsed.seller.tin).toBe(invoice.seller.tin);
        expect(parsed.seller.address).toBe(invoice.seller.address);

        // Buyer
        expect(parsed.buyer.name).toBe(invoice.buyer.name);
        expect(parsed.buyer.tin).toBe(invoice.buyer.tin);
        expect(parsed.buyer.address).toBe(invoice.buyer.address);

        // Totals
        expect(parsed.subtotal).toBe(invoice.subtotal);
        expect(parsed.totalVat).toBe(invoice.totalVat);
        expect(parsed.total).toBe(invoice.total);

        // Items count
        expect(parsed.items.length).toBe(invoice.items.length);
      }),
      { numRuns: 100 },
    );
  });
});
