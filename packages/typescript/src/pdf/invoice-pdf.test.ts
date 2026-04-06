import { describe, it, expect } from 'vitest';
import { toPDF } from './invoice-pdf';
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

function makeInvoice(itemCount: number) {
  const items: InvoiceItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    items.push({
      description: `Product ${i + 1}`,
      quantity: i + 1,
      unitPrice: 1000 * (i + 1),
      category: i % 3 === 0 ? 'standard' : i % 3 === 1 ? 'basic-food' : 'standard',
    });
  }
  return create({
    seller,
    buyer,
    items,
    invoiceNumber: `INV-PDF-${itemCount}`,
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    purchaseOrderRef: 'PO-100',
    notes: 'Payment due in 30 days',
  });
}

// ─── 17.2: Unit Tests for Invoice PDF Generation ─────────────────────────────

describe('Invoice PDF — toPDF()', () => {
  it('generates a PDF as a Buffer', async () => {
    const invoice = makeInvoice(3);
    const pdf = await toPDF(invoice);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    // PDF files start with %PDF
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('generates a PDF under 500KB for a 10-item invoice', async () => {
    const invoice = makeInvoice(10);
    const pdf = await toPDF(invoice);

    expect(pdf).toBeInstanceOf(Buffer);
    const sizeKB = pdf.length / 1024;
    expect(sizeKB).toBeLessThan(500);
  });

  it('generates a PDF for a single-item invoice', async () => {
    const invoice = create({
      seller,
      buyer,
      items: [{ description: 'Widget', quantity: 1, unitPrice: 5000 }],
      invoiceNumber: 'INV-SINGLE',
      issueDate: '2026-03-01',
    });
    const pdf = await toPDF(invoice);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('generates a PDF for a credit-note type invoice', async () => {
    const invoice = create({
      seller,
      buyer,
      items: [{ description: 'Refund item', quantity: 1, unitPrice: 2000 }],
      invoiceNumber: 'CN-001',
      type: 'credit-note',
      issueDate: '2026-04-01',
    });
    const pdf = await toPDF(invoice);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
