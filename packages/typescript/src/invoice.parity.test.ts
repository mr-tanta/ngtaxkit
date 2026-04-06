import { describe, it, expect } from 'vitest';
import { create } from './invoice';
import fs from 'fs';
import path from 'path';

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../shared/fixtures/invoice_test_cases.json'), 'utf-8')
);

describe('Invoice parity tests', () => {
  const expectedCases = fixtures.filter((tc: any) => tc.expected);
  const errorCases = fixtures.filter((tc: any) => tc.expectedError);

  it.each(expectedCases)('$description', (tc: any) => {
    const inv = create(tc.input);
    expect(inv.subtotal).toBe(tc.expected.subtotal);
    expect(inv.totalVat).toBe(tc.expected.totalVat);
    expect(inv.total).toBe(tc.expected.total);
    expect(inv.validation.valid).toBe(tc.expected.validation.valid);
    expect(inv.ublFieldCount).toBe(tc.expected.ublFieldCount);
    for (let i = 0; i < tc.expected.items.length; i++) {
      expect(inv.items[i].vatRate).toBe(tc.expected.items[i].vatRate);
      expect(inv.items[i].vatAmount).toBe(tc.expected.items[i].vatAmount);
      expect(inv.items[i].lineNet).toBe(tc.expected.items[i].lineNet);
      expect(inv.items[i].lineTotal).toBe(tc.expected.items[i].lineTotal);
    }
  });

  it.each(errorCases)('$description', (tc: any) => {
    expect(() => create(tc.input)).toThrow();
  });
});
