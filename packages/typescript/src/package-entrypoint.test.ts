import { describe, expect, it, vi } from 'vitest';

describe('package entrypoint', () => {
  it('does not require pdfkit when importing calculator APIs', async () => {
    vi.resetModules();
    vi.doMock('pdfkit', () => {
      throw new Error('pdfkit should be lazy-loaded');
    });

    const sdk = await import('./index');

    expect(sdk.vat.calculate({ amount: 1_000 }).vat).toBe(75);
    expect(sdk.paye.calculate({ grossAnnual: 1_200_000 }).annualPaye).toBeGreaterThanOrEqual(0);
    expect(sdk.tools.callTool('ngtaxkit.vat.explain_calculate', { amount: 1_000 })).toMatchObject({
      result: { vat: 75 },
    });

    vi.doUnmock('pdfkit');
  });

  it('explains how to enable PDF generation when pdfkit is missing', async () => {
    vi.resetModules();
    vi.doMock('pdfkit', () => {
      throw new Error('missing pdfkit');
    });

    const sdk = await import('./index');
    const invoice = sdk.create({
      invoiceNumber: 'INV-001',
      issueDate: '2026-05-15',
      seller: { name: 'Acme Ltd', tin: '12345678-0001', address: 'Lagos' },
      buyer: { name: 'Beta Ltd', tin: '87654321-0001', address: 'Abuja' },
      items: [{ description: 'Consulting', quantity: 1, unitPrice: 100_000 }],
    });

    await expect(sdk.toPDF(invoice)).rejects.toThrow(
      'PDF generation requires optional dependency "pdfkit". Install it with: npm install pdfkit',
    );

    vi.doUnmock('pdfkit');
  });

  it('exports invoice validation errors as runtime classes', async () => {
    const sdk = await import('./index');
    const invoiceBase = {
      invoiceNumber: 'INV-002',
      issueDate: '2026-05-15',
      seller: { name: 'Acme Ltd', tin: '12345678-0001', address: 'Lagos' },
      buyer: { name: 'Beta Ltd', tin: '87654321-0001', address: 'Abuja' },
    };

    expect(sdk.InvalidQuantityError).toBeTypeOf('function');
    expect(sdk.EmptyInvoiceError).toBeTypeOf('function');
    expect(() =>
      sdk.create({
        ...invoiceBase,
        items: [{ description: 'Consulting', quantity: 0, unitPrice: 100_000 }],
      }),
    ).toThrow(sdk.InvalidQuantityError);
    expect(() =>
      sdk.create({
        ...invoiceBase,
        items: [],
      }),
    ).toThrow(sdk.EmptyInvoiceError);
  });

  it('exposes a browser-safe entrypoint without PDF exports', async () => {
    vi.resetModules();
    vi.doMock('pdfkit', () => {
      throw new Error('browser entrypoint should not import pdfkit');
    });

    const sdk = await import('./browser');

    expect(sdk.vat.calculate({ amount: 1_000 }).vat).toBe(75);
    expect(sdk.create({
      invoiceNumber: 'INV-003',
      issueDate: '2026-05-15',
      seller: { name: 'Acme Ltd', tin: '12345678-0001', address: 'Lagos' },
      buyer: { name: 'Beta Ltd', tin: '87654321-0001', address: 'Abuja' },
      items: [{ description: 'Consulting', quantity: 1, unitPrice: 100_000 }],
    }).totalVat).toBe(7_500);
    expect('toPDF' in sdk).toBe(false);

    vi.doUnmock('pdfkit');
  });
});
