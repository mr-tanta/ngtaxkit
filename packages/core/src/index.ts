// @ngtaxkit/core — Nigerian tax calculation engine (source of truth)
// Zero dependencies, pure functions, deterministic output

// ─── Module Namespace Re-exports ─────────────────────────────────────────────
export * as vat from './vat';
export * as paye from './paye';
export * as wht from './wht';
export * as pension from './pension';
export * as statutory from './statutory';
export * as marketplace from './marketplace';
export * as payroll from './payroll';
export * as rates from './rates';

// ─── Type Re-exports ─────────────────────────────────────────────────────────
export type {
  // Literal types
  TaxCategory,
  WhtServiceType,
  NigerianState,
  // Supporting types
  TaxBand,
  CommissionBreakdown,
  VatLiability,
  TransactionBreakdown,
  StatePayrollSummary,
  PayrollTotals,
  MonthlyDeductions,
  EmployerCosts,
  ReliefBreakdown,
  // VAT
  VatCalculateOptions,
  VatResult,
  // PAYE
  PayeCalculateOptions,
  PayeResult,
  // WHT
  WhtCalculateOptions,
  WhtResult,
  // Pension
  PensionCalculateOptions,
  PensionResult,
  // Marketplace
  MarketplaceOptions,
  MarketplaceResult,
  // Payroll
  EmployeeInput,
  PayrollBatchResult,
} from './types';

// ─── Error Re-exports ────────────────────────────────────────────────────────
export {
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

export type { FieldError, ErrorCodeValue } from './errors';
