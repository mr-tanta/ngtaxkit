import type { TaxCategory, WhtServiceType, NigerianState } from './types';

// ─── Supporting Types ────────────────────────────────────────────────────────

/** A single field-level validation error. */
export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export const ErrorCode = {
  INVALID_AMOUNT: 'NGTK_INVALID_AMOUNT',
  INVALID_CATEGORY: 'NGTK_INVALID_CATEGORY',
  INVALID_SERVICE_TYPE: 'NGTK_INVALID_SERVICE_TYPE',
  INVALID_STATE: 'NGTK_INVALID_STATE',
  INVALID_PENSION_RATE: 'NGTK_INVALID_PENSION_RATE',
  INVALID_TIN: 'NGTK_INVALID_TIN',
  INVALID_DATE: 'NGTK_INVALID_DATE',
  RATE_NOT_FOUND: 'NGTK_RATE_NOT_FOUND',
  VALIDATION_ERROR: 'NGTK_VALIDATION_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─── Base Error ──────────────────────────────────────────────────────────────

/**
 * Base error class for all ngtaxkit errors.
 * Every error carries a machine-readable `code` for type discrimination,
 * a human-readable `message`, and an optional `legalBasis` citation.
 */
export class NgtaxkitError extends Error {
  readonly code: string;
  readonly legalBasis?: string;

  constructor(code: string, message: string, legalBasis?: string) {
    super(message);
    this.name = 'NgtaxkitError';
    this.code = code;
    this.legalBasis = legalBasis;
    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.legalBasis !== undefined && { legalBasis: this.legalBasis }),
    };
  }
}


// ─── Subclasses ──────────────────────────────────────────────────────────────

/** Thrown when a monetary amount is invalid (e.g. negative). */
export class InvalidAmountError extends NgtaxkitError {
  constructor(message: string, legalBasis?: string) {
    super(ErrorCode.INVALID_AMOUNT, message, legalBasis);
    this.name = 'InvalidAmountError';
  }
}

/** Thrown when an unrecognised VAT category is provided. */
export class InvalidCategoryError extends NgtaxkitError {
  readonly validCategories: TaxCategory[];

  constructor(message: string, validCategories: TaxCategory[], legalBasis?: string) {
    super(ErrorCode.INVALID_CATEGORY, message, legalBasis);
    this.name = 'InvalidCategoryError';
    this.validCategories = validCategories;
  }

  override toJSON(): object {
    return { ...super.toJSON(), validCategories: this.validCategories };
  }
}

/** Thrown when an unrecognised WHT service type is provided. */
export class InvalidServiceTypeError extends NgtaxkitError {
  readonly validServiceTypes: WhtServiceType[];

  constructor(message: string, validServiceTypes: WhtServiceType[], legalBasis?: string) {
    super(ErrorCode.INVALID_SERVICE_TYPE, message, legalBasis);
    this.name = 'InvalidServiceTypeError';
    this.validServiceTypes = validServiceTypes;
  }

  override toJSON(): object {
    return { ...super.toJSON(), validServiceTypes: this.validServiceTypes };
  }
}

/** Thrown when an invalid Nigerian state code is provided. */
export class InvalidStateError extends NgtaxkitError {
  readonly validStates: NigerianState[];

  constructor(message: string, validStates: NigerianState[], legalBasis?: string) {
    super(ErrorCode.INVALID_STATE, message, legalBasis);
    this.name = 'InvalidStateError';
    this.validStates = validStates;
  }

  override toJSON(): object {
    return { ...super.toJSON(), validStates: this.validStates };
  }
}

/** Thrown when a pension contribution rate is below the legal minimum. */
export class InvalidPensionRateError extends NgtaxkitError {
  constructor(message: string, legalBasis?: string) {
    super(ErrorCode.INVALID_PENSION_RATE, message, legalBasis);
    this.name = 'InvalidPensionRateError';
  }
}

/** Thrown when a TIN is malformed or invalid. */
export class InvalidTinError extends NgtaxkitError {
  constructor(message: string, legalBasis?: string) {
    super(ErrorCode.INVALID_TIN, message, legalBasis);
    this.name = 'InvalidTinError';
  }
}

/** Thrown when a date string is invalid or out of range. */
export class InvalidDateError extends NgtaxkitError {
  constructor(message: string, legalBasis?: string) {
    super(ErrorCode.INVALID_DATE, message, legalBasis);
    this.name = 'InvalidDateError';
  }
}

/** Thrown when a rate lookup fails (key not found in the registry). */
export class RateNotFoundError extends NgtaxkitError {
  constructor(message: string, legalBasis?: string) {
    super(ErrorCode.RATE_NOT_FOUND, message, legalBasis);
    this.name = 'RateNotFoundError';
  }
}

/** Thrown when one or more field-level validation errors occur. */
export class ValidationError extends NgtaxkitError {
  readonly errors: FieldError[];

  constructor(message: string, errors: FieldError[], legalBasis?: string) {
    super(ErrorCode.VALIDATION_ERROR, message, legalBasis);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  override toJSON(): object {
    return { ...super.toJSON(), errors: this.errors };
  }
}
