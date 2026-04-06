import { describe, it, expect } from 'vitest';
import {
  NgtaxkitError,
  InvalidAmountError,
  InvalidCategoryError,
  InvalidServiceTypeError,
  InvalidStateError,
  InvalidPensionRateError,
  InvalidTinError,
  InvalidDateError,
  RateNotFoundError,
  ValidationError,
  ErrorCode,
} from './errors';

describe('NgtaxkitError', () => {
  it('extends Error with code, message, and legalBasis', () => {
    const err = new NgtaxkitError('NGTK_TEST', 'test message', 'NTA 2025 s.1');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NgtaxkitError);
    expect(err.code).toBe('NGTK_TEST');
    expect(err.message).toBe('test message');
    expect(err.legalBasis).toBe('NTA 2025 s.1');
    expect(err.name).toBe('NgtaxkitError');
  });

  it('serializes to JSON with all fields', () => {
    const err = new NgtaxkitError('NGTK_TEST', 'msg', 'basis');
    expect(err.toJSON()).toEqual({
      name: 'NgtaxkitError',
      code: 'NGTK_TEST',
      message: 'msg',
      legalBasis: 'basis',
    });
  });

  it('omits legalBasis from JSON when undefined', () => {
    const err = new NgtaxkitError('NGTK_TEST', 'msg');
    const json = err.toJSON() as Record<string, unknown>;
    expect(json).not.toHaveProperty('legalBasis');
  });

  it('is JSON.stringify-able', () => {
    const err = new NgtaxkitError('NGTK_TEST', 'msg', 'basis');
    const parsed = JSON.parse(JSON.stringify(err.toJSON()));
    expect(parsed.code).toBe('NGTK_TEST');
  });
});

describe('InvalidAmountError', () => {
  it('has correct code and inherits from NgtaxkitError', () => {
    const err = new InvalidAmountError('Amount must be positive');
    expect(err).toBeInstanceOf(NgtaxkitError);
    expect(err.code).toBe(ErrorCode.INVALID_AMOUNT);
    expect(err.name).toBe('InvalidAmountError');
  });
});

describe('InvalidCategoryError', () => {
  it('includes validCategories in instance and JSON', () => {
    const cats = ['standard', 'basic-food'] as const;
    const err = new InvalidCategoryError('Bad category', [...cats]);
    expect(err.code).toBe(ErrorCode.INVALID_CATEGORY);
    expect(err.validCategories).toEqual(['standard', 'basic-food']);
    const json = err.toJSON() as Record<string, unknown>;
    expect(json.validCategories).toEqual(['standard', 'basic-food']);
  });
});

describe('InvalidServiceTypeError', () => {
  it('includes validServiceTypes in instance and JSON', () => {
    const types = ['professional', 'consultancy'] as const;
    const err = new InvalidServiceTypeError('Bad service type', [...types]);
    expect(err.code).toBe(ErrorCode.INVALID_SERVICE_TYPE);
    expect(err.validServiceTypes).toEqual(['professional', 'consultancy']);
    const json = err.toJSON() as Record<string, unknown>;
    expect(json.validServiceTypes).toEqual(['professional', 'consultancy']);
  });
});

describe('InvalidStateError', () => {
  it('includes validStates in instance and JSON', () => {
    const states = ['LA', 'FC'] as const;
    const err = new InvalidStateError('Bad state', [...states]);
    expect(err.code).toBe(ErrorCode.INVALID_STATE);
    expect(err.validStates).toEqual(['LA', 'FC']);
    const json = err.toJSON() as Record<string, unknown>;
    expect(json.validStates).toEqual(['LA', 'FC']);
  });
});

describe('InvalidPensionRateError', () => {
  it('has correct code', () => {
    const err = new InvalidPensionRateError('Rate below minimum', 'PRA 2014 s.4(1)');
    expect(err.code).toBe(ErrorCode.INVALID_PENSION_RATE);
    expect(err.legalBasis).toBe('PRA 2014 s.4(1)');
  });
});

describe('InvalidTinError', () => {
  it('has correct code', () => {
    const err = new InvalidTinError('Malformed TIN');
    expect(err.code).toBe(ErrorCode.INVALID_TIN);
    expect(err.name).toBe('InvalidTinError');
  });
});

describe('InvalidDateError', () => {
  it('has correct code', () => {
    const err = new InvalidDateError('Invalid date format');
    expect(err.code).toBe(ErrorCode.INVALID_DATE);
    expect(err.name).toBe('InvalidDateError');
  });
});

describe('RateNotFoundError', () => {
  it('has correct code', () => {
    const err = new RateNotFoundError('Rate key "vat.unknown" not found');
    expect(err.code).toBe(ErrorCode.RATE_NOT_FOUND);
    expect(err.name).toBe('RateNotFoundError');
  });
});

describe('ValidationError', () => {
  it('includes field errors in instance and JSON', () => {
    const fieldErrors = [
      { field: 'amount', message: 'required' },
      { field: 'category', message: 'invalid', code: 'INVALID' },
    ];
    const err = new ValidationError('Validation failed', fieldErrors);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.errors).toEqual(fieldErrors);
    const json = err.toJSON() as Record<string, unknown>;
    expect(json.errors).toEqual(fieldErrors);
  });
});

describe('type discrimination via code field', () => {
  it('allows switching on error code', () => {
    const errors: NgtaxkitError[] = [
      new InvalidAmountError('bad amount'),
      new InvalidCategoryError('bad cat', ['standard']),
      new RateNotFoundError('missing rate'),
    ];

    const codes = errors.map((e) => e.code);
    expect(codes).toEqual([
      'NGTK_INVALID_AMOUNT',
      'NGTK_INVALID_CATEGORY',
      'NGTK_RATE_NOT_FOUND',
    ]);
  });
});
