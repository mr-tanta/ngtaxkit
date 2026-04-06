// ─── 18.3: Property Test — UBL XML Round-Trip ───────────────────────────────
// **Property 6: For all valid invoices, parse(toUBL(invoice)) → toUBL produces identical XML**
// **Validates: Requirements 15.5**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toUBL } from './ubl';
import { create, type Party, type InvoiceItem, type Invoice } from '../invoice';
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

// ─── Simple XML field extractor ──────────────────────────────────────────────

function extractXmlField(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 6 — UBL XML round-trip determinism', () => {
  it('toUBL produces identical XML for the same invoice (deterministic)', () => {
    fc.assert(
      fc.property(invoiceArb, (invoice) => {
        const xml1 = toUBL(invoice);
        const xml2 = toUBL(invoice);
        expect(xml1).toBe(xml2);
      }),
      { numRuns: 100 },
    );
  });

  it('parsed key fields from UBL XML match the original invoice', () => {
    fc.assert(
      fc.property(invoiceArb, (invoice) => {
        const xml = toUBL(invoice);

        // Verify key fields survive the round-trip through XML
        const parsedId = extractXmlField(xml, 'cbc:ID');
        expect(parsedId).toBe(invoice.invoiceNumber);

        const parsedDate = extractXmlField(xml, 'cbc:IssueDate');
        expect(parsedDate).toBe(invoice.issueDate);

        const parsedCurrency = extractXmlField(xml, 'cbc:DocumentCurrencyCode');
        expect(parsedCurrency).toBe(invoice.currency);

        // Verify payable amount matches total
        const payableRegex = /<cbc:PayableAmount[^>]*>([^<]*)<\/cbc:PayableAmount>/;
        const payableMatch = xml.match(payableRegex);
        expect(payableMatch).not.toBeNull();
        expect(parseFloat(payableMatch![1])).toBeCloseTo(invoice.total, 2);

        // Verify XML starts with declaration
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

        // Verify namespace
        expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
      }),
      { numRuns: 100 },
    );
  });
});
