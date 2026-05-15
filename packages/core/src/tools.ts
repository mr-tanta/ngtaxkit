// ─── Tooling ─────────────────────────────────────────────────────────────────
// Zero-dependency schemas and dispatcher for deterministic integrations.

import { ValidationError } from './errors';
import * as paye from './paye';
import * as rates from './rates';
import type { TaxCategory, WhtServiceType } from './types';
import * as vat from './vat';
import * as wht from './wht';

export type ToolName =
  | 'ngtaxkit.vat.explain_calculate'
  | 'ngtaxkit.paye.explain_calculate'
  | 'ngtaxkit.wht.explain_calculate'
  | 'ngtaxkit.rates.explain'
  | 'ngtaxkit.rates.audit';

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  description?: string;
}

export interface ToolSchema {
  name: ToolName;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
}

export interface OpenApiSpec {
  openapi: '3.1.0';
  info: { title: string; version: string };
  paths: Record<string, {
    post: {
      operationId: ToolName;
      summary: string;
      requestBody: { required: true; content: { 'application/json': { schema: JsonSchema } } };
      responses: { '200': { description: string; content: { 'application/json': { schema: JsonSchema } } } };
    };
  }>;
}

const explanationOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    result: { type: 'object', additionalProperties: true },
    formula: { type: 'array', items: { type: 'string' } },
    rateKeys: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'object', additionalProperties: true } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

const rateSourceOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    key: { type: 'string' },
    value: {},
    sourceTitle: { type: 'string' },
    sourceUrl: { type: 'string' },
    legalBasis: { type: 'string' },
  },
};

const tools: ToolSchema[] = [
  {
    name: 'ngtaxkit.vat.explain_calculate',
    description: 'Calculate Nigerian VAT and return formula steps, rate keys, source metadata, and warnings.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['amount'],
      properties: {
        amount: { type: 'number', description: 'Naira amount.' },
        inclusive: { type: 'boolean', description: 'True when amount already includes VAT.' },
        category: { type: 'string', description: 'VAT category. Defaults to standard.' },
        date: { type: 'string', description: 'Optional ISO date for rate-regime selection.' },
      },
    },
    outputSchema: explanationOutputSchema,
  },
  {
    name: 'ngtaxkit.paye.explain_calculate',
    description: 'Calculate Nigerian PAYE and return formula steps, rate keys, source metadata, and warnings.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['grossAnnual'],
      properties: {
        grossAnnual: { type: 'number', description: 'Annual gross income in naira.' },
        pensionContributing: { type: 'boolean' },
        nhfContributing: { type: 'boolean' },
        rentPaidAnnual: { type: 'number' },
        disabilityStatus: { type: 'boolean' },
        taxYear: { type: 'number' },
      },
    },
    outputSchema: explanationOutputSchema,
  },
  {
    name: 'ngtaxkit.wht.explain_calculate',
    description: 'Calculate Nigerian WHT and return formula steps, rate keys, source metadata, and warnings.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['amount', 'payeeType', 'serviceType'],
      properties: {
        amount: { type: 'number', description: 'Gross payment amount in naira.' },
        payeeType: { type: 'string', enum: ['individual', 'company'] },
        serviceType: { type: 'string' },
        payeeIsSmallCompany: { type: 'boolean' },
        payeeTin: { type: 'string' },
        paymentDate: { type: 'string', description: 'ISO payment date used for remittance deadline.' },
      },
    },
    outputSchema: explanationOutputSchema,
  },
  {
    name: 'ngtaxkit.rates.explain',
    description: 'Explain a bundled rate key with source metadata.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['key'],
      properties: {
        key: { type: 'string', description: 'Dot-path rate key, for example vat.standard.rate.' },
      },
    },
    outputSchema: rateSourceOutputSchema,
  },
  {
    name: 'ngtaxkit.rates.audit',
    description: 'Audit bundled rate source metadata coverage.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        version: { type: 'string' },
        totalKeys: { type: 'number' },
        missingMetadata: { type: 'array', items: { type: 'string' } },
      },
    },
  },
];

export function getToolSchemas(): ToolSchema[] {
  return tools;
}

export function getOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ngtaxkit Tool API',
      version: rates.getVersion(),
    },
    paths: Object.fromEntries([
      openApiPath('/vat/explain-calculate', tools[0]),
      openApiPath('/paye/explain-calculate', tools[1]),
      openApiPath('/wht/explain-calculate', tools[2]),
      openApiPath('/rates/explain', tools[3]),
      openApiPath('/rates/audit', tools[4]),
    ]),
  };
}

function openApiPath(path: string, tool: ToolSchema): [string, OpenApiSpec['paths'][string]] {
  return [path, {
    post: {
      operationId: tool.name,
      summary: tool.description,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: tool.inputSchema } },
      },
      responses: {
        '200': {
          description: 'Tool result',
          content: { 'application/json': { schema: tool.outputSchema } },
        },
      },
    },
  }];
}

export function callTool(name: ToolName, input: Record<string, unknown>): unknown {
  switch (name) {
    case 'ngtaxkit.vat.explain_calculate':
      return vat.explainCalculate({
        amount: requireNumber(input, 'amount'),
        inclusive: optionalBoolean(input, 'inclusive'),
        category: optionalString(input, 'category') as TaxCategory | undefined,
        date: optionalString(input, 'date'),
      });
    case 'ngtaxkit.paye.explain_calculate':
      return paye.explainCalculate({
        grossAnnual: requireNumber(input, 'grossAnnual'),
        pensionContributing: optionalBoolean(input, 'pensionContributing'),
        nhfContributing: optionalBoolean(input, 'nhfContributing'),
        rentPaidAnnual: optionalNumber(input, 'rentPaidAnnual'),
        disabilityStatus: optionalBoolean(input, 'disabilityStatus'),
        taxYear: optionalNumber(input, 'taxYear'),
      });
    case 'ngtaxkit.wht.explain_calculate':
      return wht.explainCalculate({
        amount: requireNumber(input, 'amount'),
        payeeType: requireString(input, 'payeeType') as 'individual' | 'company',
        serviceType: requireString(input, 'serviceType') as WhtServiceType,
        payeeIsSmallCompany: optionalBoolean(input, 'payeeIsSmallCompany'),
        payeeTin: optionalString(input, 'payeeTin'),
        paymentDate: optionalString(input, 'paymentDate'),
      });
    case 'ngtaxkit.rates.explain':
      return rates.explain(requireString(input, 'key'));
    case 'ngtaxkit.rates.audit':
      return rates.audit();
    default:
      throw new ValidationError(`Unknown ngtaxkit tool "${name}"`, [
        { field: 'name', message: 'Tool name is not registered' },
      ]);
  }
}

function requireNumber(input: Record<string, unknown>, field: string): number {
  const value = input[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`Field "${field}" must be a finite number`, [
      { field, message: 'Expected finite number' },
    ]);
  }
  return value;
}

function optionalNumber(input: Record<string, unknown>, field: string): number | undefined {
  if (input[field] === undefined) {
    return undefined;
  }
  return requireNumber(input, field);
}

function requireString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Field "${field}" must be a non-empty string`, [
      { field, message: 'Expected non-empty string' },
    ]);
  }
  return value;
}

function optionalString(input: Record<string, unknown>, field: string): string | undefined {
  if (input[field] === undefined) {
    return undefined;
  }
  return requireString(input, field);
}

function optionalBoolean(input: Record<string, unknown>, field: string): boolean | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new ValidationError(`Field "${field}" must be a boolean`, [
      { field, message: 'Expected boolean' },
    ]);
  }
  return value;
}
