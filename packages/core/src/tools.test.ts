import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import { callTool, getOpenApiSpec, getToolSchemas } from './tools';

describe('tooling', () => {
  it('exposes tool schemas for source-backed calculators', () => {
    const schemas = getToolSchemas();

    expect(schemas.map((schema) => schema.name)).toEqual(expect.arrayContaining([
      'ngtaxkit.vat.explain_calculate',
      'ngtaxkit.paye.explain_calculate',
      'ngtaxkit.wht.explain_calculate',
      'ngtaxkit.rates.explain',
      'ngtaxkit.rates.audit',
    ]));
    expect(schemas.find((schema) => schema.name === 'ngtaxkit.vat.explain_calculate')?.inputSchema.required).toContain('amount');
  });

  it('calls VAT explanation tools with structured input', () => {
    const result = callTool('ngtaxkit.vat.explain_calculate', {
      amount: 100_000,
      category: 'standard',
    });

    expect(result).toMatchObject({
      result: { vat: 7_500 },
      rateKeys: ['vat.standard.rate'],
    });
  });

  it('calls rate explanation tools', () => {
    const result = callTool('ngtaxkit.rates.explain', { key: 'vat.standard.rate' });

    expect(result).toMatchObject({
      key: 'vat.standard.rate',
      value: 0.075,
      sourceTitle: 'Nigeria Tax Act, 2025',
    });
  });

  it('rejects unknown tool names', () => {
    expect(() => callTool('ngtaxkit.nope' as never, {})).toThrow(ValidationError);
  });

  it('exports an OpenAPI spec for HTTP wrappers', () => {
    const spec = getOpenApiSpec();

    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths)).toContain('/vat/explain-calculate');
    expect(spec.paths['/vat/explain-calculate'].post.operationId).toBe('ngtaxkit.vat.explain_calculate');
  });
});
