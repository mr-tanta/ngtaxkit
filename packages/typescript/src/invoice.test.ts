import { describe, it, expect } from 'vitest';
import {
  create,
  validate,
  toFIRSJSON,
  toCSV,
  InvalidQuantityError,
  EmptyInvoiceError,
  type Party,
  type InvoiceItem,
  type Invoice,
} from './invoice';
import { InvalidAmountError } from '@ngtaxkit/core';

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

// ─── 16.3: Unit Tests ────────────────────────────────────────────────────────

describe('Invoice — create()', () => {
  it('auto-calculates VAT per line item at 7.5% standard rate', () => {
    const items: InvoiceItem[] = [
      { description: 'Widget A', quantity: 2, unitPrice: 1000 },
      { description: 'Widget B', quantity: 1, unitPrice: 5000 },
    ];

    const inv = create({ seller, buyer, items, invoiceNumber: 'INV-001' });

    // Line 1: net = 2000, vat = 150, total = 2150
    expect(inv.items[0].lineNet).toBe(2000);
    expect(inv.items[0].vatAmount).toBe(150);
    expect(inv.items[0].lineTotal).toBe(2150);
    expect(inv.items[0].vatRate).toBe(0.075);

    // Line 2: net = 5000, vat = 375, total = 5375
    expect(inv.items[1].lineNet).toBe(5000);
    expect(inv.items[1].vatAmount).toBe(375);
    expect(inv.items[1].lineTotal).toBe(5375);

    // Totals
    expect(inv.subtotal).toBe(7000);
    expect(inv.totalVat).toBe(525);
    expect(inv.total).toBe(7525);
  });

  it('supports mixed VAT categories within a single invoice', () => {
    const items: InvoiceItem[] = [
      { description: 'Laptop', quantity: 1, unitPrice: 500000, category: 'standard' },
      { description: 'Rice (50kg)', quantity: 10, unitPrice: 25000, category: 'basic-food' },
      { description: 'Insurance Premium', quantity: 1, unitPrice: 100000, category: 'insurance' },
    ];

    const inv = create({ seller, buyer, items, invoiceNumber: 'INV-002' });

    // Standard: net=500000, vat=37500
    expect(inv.items[0].vatRate).toBe(0.075);
    expect(inv.items[0].vatAmount).toBe(37500);

    // Zero-rated: net=250000, vat=0
    expect(inv.items[1].vatRate).toBe(0);
    expect(inv.items[1].vatAmount).toBe(0);

    // Exempt: net=100000, vat=0
    expect(inv.items[2].vatRate).toBe(0);
    expect(inv.items[2].vatAmount).toBe(0);

    // VAT breakdown should have entries for each unique rate
    expect(inv.vatBreakdown.length).toBe(2); // 0.075 and 0
    const standardBreakdown = inv.vatBreakdown.find((b) => b.rate === 0.075);
    const zeroBreakdown = inv.vatBreakdown.find((b) => b.rate === 0);
    expect(standardBreakdown).toBeDefined();
    expect(standardBreakdown!.taxableAmount).toBe(500000);
    expect(standardBreakdown!.vatAmount).toBe(37500);
    expect(zeroBreakdown).toBeDefined();
    // zero-rated + exempt both have rate 0
    expect(zeroBreakdown!.taxableAmount).toBe(350000);
    expect(zeroBreakdown!.vatAmount).toBe(0);

    expect(inv.subtotal).toBe(850000);
    expect(inv.totalVat).toBe(37500);
    expect(inv.total).toBe(887500);
  });

  it('defaults to invoice type and NGN currency', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-003',
    });
    expect(inv.type).toBe('invoice');
    expect(inv.currency).toBe('NGN');
  });

  it('supports credit-note type', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Refund', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'CN-001',
      type: 'credit-note',
    });
    expect(inv.type).toBe('credit-note');
  });

  it('supports debit-note type', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Adjustment', quantity: 1, unitPrice: 500 }],
      invoiceNumber: 'DN-001',
      type: 'debit-note',
    });
    expect(inv.type).toBe('debit-note');
  });

  it('sets issueDate to today if not provided', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-004',
    });
    // Should be a valid ISO date
    expect(inv.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('preserves optional fields (dueDate, purchaseOrderRef, notes)', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-005',
      dueDate: '2026-02-28',
      purchaseOrderRef: 'PO-123',
      notes: 'Payment due in 30 days',
    });
    expect(inv.dueDate).toBe('2026-02-28');
    expect(inv.purchaseOrderRef).toBe('PO-123');
    expect(inv.notes).toBe('Payment due in 30 days');
  });

  it('computes ublFieldCount > 0 for a valid invoice', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-006',
    });
    expect(inv.ublFieldCount).toBeGreaterThan(0);
  });
});

describe('Invoice — error cases', () => {
  it('throws EmptyInvoiceError for empty items array', () => {
    expect(() =>
      create({ seller, buyer, items: [], invoiceNumber: 'INV-ERR-1' }),
    ).toThrow(EmptyInvoiceError);
  });

  it('throws InvalidAmountError for negative unit price', () => {
    expect(() =>
      create({
        seller,
        buyer,
        items: [{ description: 'Bad item', quantity: 1, unitPrice: -500 }],
        invoiceNumber: 'INV-ERR-2',
      }),
    ).toThrow(InvalidAmountError);
  });

  it('throws InvalidQuantityError for zero quantity', () => {
    expect(() =>
      create({
        seller,
        buyer,
        items: [{ description: 'Bad item', quantity: 0, unitPrice: 100 }],
        invoiceNumber: 'INV-ERR-3',
      }),
    ).toThrow(InvalidQuantityError);
  });

  it('throws InvalidQuantityError for negative quantity', () => {
    expect(() =>
      create({
        seller,
        buyer,
        items: [{ description: 'Bad item', quantity: -2, unitPrice: 100 }],
        invoiceNumber: 'INV-ERR-4',
      }),
    ).toThrow(InvalidQuantityError);
  });
});

describe('Invoice — validate()', () => {
  it('returns valid=true for a complete invoice', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-1',
    });
    const result = validate(inv);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing invoiceNumber', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-2',
    });
    // Manually blank out the invoice number to test validation
    const broken = { ...inv, invoiceNumber: '' };
    const result = validate(broken as Invoice);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'invoiceNumber')).toBe(true);
  });

  it('detects missing seller name', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-3',
    });
    const broken = { ...inv, seller: { ...inv.seller, name: '' } };
    const result = validate(broken as Invoice);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'seller.name')).toBe(true);
  });

  it('detects missing buyer TIN', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-4',
    });
    const broken = { ...inv, buyer: { ...inv.buyer, tin: '' } };
    const result = validate(broken as Invoice);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'buyer.tin')).toBe(true);
  });

  it('detects missing issueDate', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-5',
    });
    const broken = { ...inv, issueDate: '' };
    const result = validate(broken as Invoice);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'issueDate')).toBe(true);
  });

  it('detects empty items array', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-6',
    });
    const broken = { ...inv, items: [] };
    const result = validate(broken as Invoice);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'items')).toBe(true);
  });

  it('detects missing line item description', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-VAL-7',
    });
    const broken = {
      ...inv,
      items: [{ ...inv.items[0], description: '' }],
    };
    const result = validate(broken as Invoice);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'items[0].description')).toBe(true);
  });

  it('validates the invoice returned by create() is valid', () => {
    const inv = create({
      seller,
      buyer,
      items: [
        { description: 'Standard item', quantity: 5, unitPrice: 2000 },
        { description: 'Food item', quantity: 10, unitPrice: 500, category: 'basic-food' },
      ],
      invoiceNumber: 'INV-VAL-8',
    });
    expect(inv.validation.valid).toBe(true);
    expect(inv.validation.errors).toHaveLength(0);
  });
});


// ─── 19.3: Unit Tests for FIRS JSON and CSV Generation ───────────────────────
// Requirements: 16.1, 33.1

describe('FIRS JSON — toFIRSJSON()', () => {
  it('generates valid JSON with all mandatory fields', () => {
    const inv = create({
      seller,
      buyer,
      items: [
        { description: 'Widget A', quantity: 2, unitPrice: 1000, category: 'standard' },
        { description: 'Rice', quantity: 5, unitPrice: 25000, category: 'basic-food' },
      ],
      invoiceNumber: 'INV-JSON-001',
      issueDate: '2026-01-15',
      dueDate: '2026-02-15',
      purchaseOrderRef: 'PO-200',
      notes: 'Test notes',
    });

    const jsonStr = toFIRSJSON(inv);
    const parsed = JSON.parse(jsonStr);

    // Invoice-level fields
    expect(parsed.invoiceNumber).toBe('INV-JSON-001');
    expect(parsed.invoiceType).toBe('invoice');
    expect(parsed.issueDate).toBe('2026-01-15');
    expect(parsed.dueDate).toBe('2026-02-15');
    expect(parsed.currency).toBe('NGN');
    expect(parsed.purchaseOrderRef).toBe('PO-200');
    expect(parsed.notes).toBe('Test notes');

    // Seller fields
    expect(parsed.seller.name).toBe('Acme Nigeria Ltd');
    expect(parsed.seller.tin).toBe('12345678-0001');
    expect(parsed.seller.address).toBe('123 Marina Road, Lagos');
    expect(parsed.seller.vrn).toBe('VRN-001');

    // Buyer fields
    expect(parsed.buyer.name).toBe('Buyer Corp');
    expect(parsed.buyer.tin).toBe('98765432-0001');
    expect(parsed.buyer.address).toBe('456 Broad Street, Abuja');

    // Items
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].lineId).toBe(1);
    expect(parsed.items[0].description).toBe('Widget A');
    expect(parsed.items[0].quantity).toBe(2);
    expect(parsed.items[0].unitPrice).toBe(1000);
    expect(parsed.items[0].vatRate).toBe(0.075);
    expect(parsed.items[0].vatAmount).toBe(150);
    expect(parsed.items[0].lineNet).toBe(2000);
    expect(parsed.items[0].lineTotal).toBe(2150);

    // Totals
    expect(parsed.subtotal).toBe(inv.subtotal);
    expect(parsed.totalVat).toBe(inv.totalVat);
    expect(parsed.total).toBe(inv.total);

    // VAT breakdown
    expect(parsed.vatBreakdown.length).toBeGreaterThan(0);
    for (const entry of parsed.vatBreakdown) {
      expect(entry).toHaveProperty('rate');
      expect(entry).toHaveProperty('rateType');
      expect(entry).toHaveProperty('taxableAmount');
      expect(entry).toHaveProperty('vatAmount');
    }

    // Validation and field count
    expect(parsed.validation).toHaveProperty('valid');
    expect(parsed.ublFieldCount).toBeGreaterThan(0);
  });

  it('produces deterministic output (same input → same JSON)', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Item', quantity: 1, unitPrice: 500 }],
      invoiceNumber: 'INV-DET-001',
      issueDate: '2026-03-01',
    });
    const json1 = toFIRSJSON(inv);
    const json2 = toFIRSJSON(inv);
    expect(json1).toBe(json2);
  });

  it('sets null for optional fields when not provided', () => {
    const inv = create({
      seller: { name: 'S', tin: '111', address: 'A' },
      buyer: { name: 'B', tin: '222', address: 'B' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-NULL',
      issueDate: '2026-01-01',
    });
    const parsed = JSON.parse(toFIRSJSON(inv));
    expect(parsed.dueDate).toBeNull();
    expect(parsed.purchaseOrderRef).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.seller.vrn).toBeNull();
    expect(parsed.buyer.vrn).toBeNull();
  });
});

describe('CSV — toCSV()', () => {
  it('generates CSV with header row and one row per invoice', () => {
    const inv1 = create({
      seller,
      buyer,
      items: [{ description: 'Widget', quantity: 1, unitPrice: 1000 }],
      invoiceNumber: 'INV-CSV-001',
      issueDate: '2026-01-15',
    });
    const inv2 = create({
      seller,
      buyer,
      items: [{ description: 'Gadget', quantity: 2, unitPrice: 2000 }],
      invoiceNumber: 'INV-CSV-002',
      issueDate: '2026-02-20',
    });

    const csv = toCSV([inv1, inv2]);
    const lines = csv.split('\n');

    // Header
    expect(lines[0]).toBe('Invoice Number,Date,Buyer,Seller,Subtotal,VAT,Total,Status');

    // Row 1
    expect(lines[1]).toContain('INV-CSV-001');
    expect(lines[1]).toContain('2026-01-15');
    expect(lines[1]).toContain('Buyer Corp');
    expect(lines[1]).toContain('Acme Nigeria Ltd');
    expect(lines[1]).toContain('valid');

    // Row 2
    expect(lines[2]).toContain('INV-CSV-002');
    expect(lines[2]).toContain('2026-02-20');

    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it('returns only header for empty invoice array', () => {
    const csv = toCSV([]);
    expect(csv).toBe('Invoice Number,Date,Buyer,Seller,Subtotal,VAT,Total,Status');
  });

  it('escapes fields containing commas', () => {
    const inv = create({
      seller: { name: 'Acme, Inc.', tin: '111', address: 'A' },
      buyer: { name: 'Buyer', tin: '222', address: 'B' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      invoiceNumber: 'INV-ESC',
      issueDate: '2026-01-01',
    });
    const csv = toCSV([inv]);
    const lines = csv.split('\n');
    // Seller name with comma should be quoted
    expect(lines[1]).toContain('"Acme, Inc."');
  });

  it('includes correct numeric totals in CSV', () => {
    const inv = create({
      seller,
      buyer,
      items: [{ description: 'Widget', quantity: 3, unitPrice: 10000 }],
      invoiceNumber: 'INV-NUM',
      issueDate: '2026-01-01',
    });
    const csv = toCSV([inv]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    // subtotal=30000, vat=2250, total=32250
    expect(fields[4]).toBe('30000.00');
    expect(fields[5]).toBe('2250.00');
    expect(fields[6]).toBe('32250.00');
  });
});
