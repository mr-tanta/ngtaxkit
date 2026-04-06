import { describe, it, expect } from 'vitest';
import { create } from '../invoice';
import { toUBL } from './ubl';
import fs from 'fs';
import path from 'path';

const fixtures: Record<string, unknown>[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../shared/fixtures/ubl_test_cases.json'), 'utf-8')
);

describe('UBL parity tests', () => {
  for (const tc of fixtures) {
    const { description, input, expected } = tc as any;
    it(description, () => {
      const inv = create(input);
      const xml = toUBL(inv);
      expect(xml).toBe(expected);
    });
  }
});
