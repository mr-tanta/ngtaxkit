// @tantainnovative/ngtaxkit — npm package
// Re-exports core (Layer 1) + Layer 2 document generation modules

// ─── Layer 1: Core Calculation Engine (re-export everything) ─────────────────
export {
  // Module namespaces
  vat,
  paye,
  wht,
  pension,
  statutory,
  marketplace,
  payroll,
  rates,
  // Errors
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
} from '@ngtaxkit/core';

// Re-export all types from core
export type {
  TaxCategory,
  WhtServiceType,
  NigerianState,
  TaxBand,
  CommissionBreakdown,
  VatLiability,
  TransactionBreakdown,
  StatePayrollSummary,
  PayrollTotals,
  MonthlyDeductions,
  EmployerCosts,
  ReliefBreakdown,
  VatCalculateOptions,
  VatResult,
  PayeCalculateOptions,
  PayeResult,
  WhtCalculateOptions,
  WhtResult,
  PensionCalculateOptions,
  PensionResult,
  MarketplaceOptions,
  MarketplaceResult,
  EmployeeInput,
  PayrollBatchResult,
  FieldError,
  ErrorCodeValue,
} from '@ngtaxkit/core';

// ─── Layer 2: Invoice Module ─────────────────────────────────────────────────
export { create, validate, toFIRSJSON, toCSV } from './invoice';
export type {
  Party,
  InvoiceItem,
  ComputedInvoiceItem,
  VatBreakdown,
  ValidationResult,
  ValidationFieldError,
  InvoiceType,
  InvoiceCreateOptions,
  Invoice,
  InvalidQuantityError,
  EmptyInvoiceError,
} from './invoice';

// ─── Layer 2: PDF Generation ─────────────────────────────────────────────────
export { toPDF } from './pdf/invoice-pdf';

// ─── Layer 2: UBL XML ────────────────────────────────────────────────────────
export { toUBL } from './xml/ubl';

// ─── Layer 2: Document Modules (namespace exports) ───────────────────────────
export * as whtCreditNote from './pdf/wht-credit-note';
export * as formH1 from './pdf/form-h1';
export * as payslip from './pdf/payslip';
export * as vatReturn from './pdf/vat-return';

// ─── Layer 3: Cloud Client (stub) ───────────────────────────────────────────
export interface CloudClientOptions {
  apiKey: string;
  environment: 'production' | 'sandbox';
}

/**
 * Stub cloud client for Layer 3 API.
 * Full implementation will connect to api.ngtaxkit.dev.
 */
export class NgtaxkitCloud {
  private options: CloudClientOptions;

  constructor(options: CloudClientOptions) {
    this.options = options;
  }

  get environment(): string {
    return this.options.environment;
  }
}
