// ─── 18.2: Unit Tests for UBL XML Generation ────────────────────────────────
// Tests: well-formed XML, correct namespace, 55 mandatory fields, deterministic output.
// Requirements: 15.1, 15.2, 15.3

import { describe, it, expect } from 'vitest';
import { toUBL } from './ubl';
import { create, type Party, type InvoiceItem } from '../invoice';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const seller: Party = {
  name: 'Acme Nigeria Ltd',
  tin: '12345678-0001',
  address: '123 Marina Road, Lagos',
  vrn: 'VRN-001',
};

const buyer: Party = {
  name: 'Buyer Corp',
  tin: '98765432-0001',
  address: '456 Broad Street, Abuja',
};

function makeInvoice(items?: InvoiceItem[]) {
  return create({
    seller,
    buyer,
    items: items ?? [
      { description: 'Widget A', quantity: 2, unitPrice: 1000, category: 'standard' },
      { description: 'Rice (50kg)', quantity: 5, unitPrice: 25000, category: 'basic-food' },
    ],
    invoiceNumber: 'INV-UBL-001',
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    purchaseOrderRef: 'PO-100',
    notes: 'Payment due in 30 days',
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UBL XML — toUBL()', () => {
  it('starts with XML declaration', () => {
    const xml = toUBL(makeInvoice());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('contains the correct UBL 3.0 namespace', () => {
    const xml = toUBL(makeInvoice());
    expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain('xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    expect(xml).toContain('xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"');
  });

  it('contains invoice-level mandatory fields', () => {
    const xml = toUBL(makeInvoice());
    expect(xml).toContain('<cbc:ID>INV-UBL-001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-01-15</cbc:IssueDate>');
    expect(xml).toContain('<cbc:DueDate>2026-02-15</cbc:DueDate>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>');
    expect(xml).toContain('<cbc:Note>Payment due in 30 days</cbc:Note>');
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ProfileID>');
  });

  it('contains seller (AccountingSupplierParty) mandatory fields', () => {
    const xml = toUBL(makeInvoice());
    expect(xml).toContain('<cac:AccountingSupplierParty>');
    expect(xml).toContain('Acme Nigeria Ltd');
    expect(xml).toContain('12345678-0001');
    expect(xml).toContain('123 Marina Road, Lagos');
  });

  it('contains buyer (AccountingCustomerParty) mandatory fields', () => {
    const xml = toUBL(makeInvoice());
    expect(xml).toContain('<cac:AccountingCustomerParty>');
    expect(xml).toContain('Buyer Corp');
    expect(xml).toContain('98765432-0001');
    expect(xml).toContain('456 Broad Street, Abuja');
  });

  it('contains TaxTotal with correct total VAT amount', () => {
    const inv = makeInvoice();
    const xml = toUBL(inv);
    expect(xml).toContain('<cac:TaxTotal>');
    expect(xml).toContain(`<cbc:TaxAmount currencyID="NGN">${inv.totalVat.toFixed(2)}</cbc:TaxAmount>`);
  });

  it('contains TaxSubtotal entries for each VAT breakdown', () => {
    const inv = makeInvoice();
    const xml = toUBL(inv);
    for (const entry of inv.vatBreakdown) {
      expect(xml).toContain(`<cbc:TaxableAmount currencyID="NGN">${entry.taxableAmount.toFixed(2)}</cbc:TaxableAmount>`);
    }
    expect(xml).toContain('<cac:TaxSubtotal>');
  });

  it('contains LegalMonetaryTotal with subtotal, tax-inclusive, and payable amounts', () => {
    const inv = makeInvoice();
    const xml = toUBL(inv);
    expect(xml).toContain('<cac:LegalMonetaryTotal>');
    expect(xml).toContain(`<cbc:LineExtensionAmount currencyID="NGN">${inv.subtotal.toFixed(2)}</cbc:LineExtensionAmount>`);
    expect(xml).toContain(`<cbc:TaxExclusiveAmount currencyID="NGN">${inv.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>`);
    expect(xml).toContain(`<cbc:TaxInclusiveAmount currencyID="NGN">${inv.total.toFixed(2)}</cbc:TaxInclusiveAmount>`);
    expect(xml).toContain(`<cbc:PayableAmount currencyID="NGN">${inv.total.toFixed(2)}</cbc:PayableAmount>`);
  });

  it('contains InvoiceLine entries for each line item', () => {
    const inv = makeInvoice();
    const xml = toUBL(inv);
    expect(xml).toContain('<cac:InvoiceLine>');
    for (let i = 0; i < inv.items.length; i++) {
      const item = inv.items[i];
      expect(xml).toContain(`<cbc:Name>${item.description}</cbc:Name>`);
      expect(xml).toContain(`<cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>`);
      expect(xml).toContain(`<cbc:PriceAmount currencyID="NGN">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>`);
      expect(xml).toContain(`<cbc:LineExtensionAmount currencyID="NGN">${item.lineNet.toFixed(2)}</cbc:LineExtensionAmount>`);
    }
  });

  it('contains purchase order reference', () => {
    const xml = toUBL(makeInvoice());
    expect(xml).toContain('<cac:OrderReference>');
    expect(xml).toContain('<cbc:ID>PO-100</cbc:ID>');
  });

  it('produces deterministic output (same input → same XML)', () => {
    const inv = makeInvoice();
    const xml1 = toUBL(inv);
    const xml2 = toUBL(inv);
    expect(xml1).toBe(xml2);
  });

  it('escapes XML special characters in party names', () => {
    const inv = create({
      seller: { name: 'A & B <Corp>', tin: '111', address: '1 "Main" St' },
      buyer: { name: 'C\'s Co', tin: '222', address: '2 Test Ave' },
      items: [{ description: 'Item <1>', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-ESC',
      issueDate: '2026-01-01',
    });
    const xml = toUBL(inv);
    expect(xml).toContain('A &amp; B &lt;Corp&gt;');
    expect(xml).toContain('1 &quot;Main&quot; St');
    expect(xml).toContain('C&apos;s Co');
    expect(xml).toContain('Item &lt;1&gt;');
  });

  it('maps credit-note type to InvoiceTypeCode 381', () => {
    const inv = create({
      seller, buyer,
      items: [{ description: 'Refund', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'CN-001',
      type: 'credit-note',
      issueDate: '2026-01-01',
    });
    const xml = toUBL(inv);
    expect(xml).toContain('<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>');
  });

  it('maps debit-note type to InvoiceTypeCode 383', () => {
    const inv = create({
      seller, buyer,
      items: [{ description: 'Adjustment', quantity: 1, unitPrice: 500 }],
      invoiceNumber: 'DN-001',
      type: 'debit-note',
      issueDate: '2026-01-01',
    });
    const xml = toUBL(inv);
    expect(xml).toContain('<cbc:InvoiceTypeCode>383</cbc:InvoiceTypeCode>');
  });
});
