import { describe, it, expect } from 'vitest';
import { create } from '../invoice';
import { toUBL } from './ubl';
import fs from 'fs';
import path from 'path';

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../shared/fixtures/ubl_test_cases.json'), 'utf-8')
);

describe('UBL parity tests', () => {
  it.each(fixtures)('$description', (tc: any) => {
    const inv = create(tc.input);
    const xml = toUBL(inv);
    expect(xml).toBe(tc.expected);
  });
});
