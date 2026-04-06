import { describe, it, expect } from 'vitest';
import { create } from './invoice';
import fs from 'fs';
import path from 'path';

const fixtures: Record<string, unknown>[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../shared/fixtures/invoice_test_cases.json'), 'utf-8')
);

describe('Invoice parity tests', () => {
  for (const tc of fixtures) {
    const { description, input, expected, expectedError } = tc as any;

    if (expected) {
      it(description, () => {
        const inv = create(input);
        expect(inv.subtotal).toBe(expected.subtotal);
        expect(inv.totalVat).toBe(expected.totalVat);
        expect(inv.total).toBe(expected.total);
        expect(inv.validation.valid).toBe(expected.validation.valid);
        expect(inv.ublFieldCount).toBe(expected.ublFieldCount);
        for (let i = 0; i < expected.items.length; i++) {
          expect(inv.items[i].vatRate).toBe(expected.items[i].vatRate);
          expect(inv.items[i].vatAmount).toBe(expected.items[i].vatAmount);
          expect(inv.items[i].lineNet).toBe(expected.items[i].lineNet);
          expect(inv.items[i].lineTotal).toBe(expected.items[i].lineTotal);
        }
      });
    }

    if (expectedError) {
      it(description, () => {
        expect(() => create(input)).toThrow();
      });
    }
  }
});
