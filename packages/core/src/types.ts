// ─── Literal Types ───────────────────────────────────────────────────────────

/**
 * VAT category classification per NTA 2025.
 * - standard: 7.5% VAT
 * - zero-rated: 0% VAT, input VAT recoverable
 * - exempt: 0% VAT, input VAT NOT recoverable
 */
export type TaxCategory =
  | 'standard'
  | 'basic-food'
  | 'medicine'
  | 'medical-equipment'
  | 'medical-services'
  | 'educational-books'
  | 'tuition'
  | 'electricity'
  | 'export-services'
  | 'humanitarian-goods'
  | 'residential-rent'
  | 'public-transport'
  | 'financial-services'
  | 'insurance';

/**
 * WHT service type classification per WHT Regulations 2024.
 */
export type WhtServiceType =
  | 'professional'
  | 'management'
  | 'technical'
  | 'consultancy'
  | 'commission'
  | 'construction'
  | 'contract'
  | 'rent'
  | 'royalty'
  | 'dividend'
  | 'interest';

/**
 * Nigerian state codes — 36 states plus FCT (Federal Capital Territory).
 */
export type NigerianState =
  | 'AB' | 'AD' | 'AK' | 'AN' | 'BA' | 'BY' | 'BE' | 'BO'
  | 'CR' | 'DE' | 'EB' | 'ED' | 'EK' | 'EN' | 'FC' | 'GO'
  | 'IM' | 'JI' | 'KD' | 'KN' | 'KT' | 'KE' | 'KO' | 'KW'
  | 'LA' | 'NA' | 'NI' | 'OG' | 'ON' | 'OS' | 'OY' | 'PL'
  | 'RI' | 'SO' | 'TA' | 'YO' | 'ZA';

// ─── Supporting Types ────────────────────────────────────────────────────────

/** A single PAYE graduated tax band with computed tax. */
export interface TaxBand {
  lower: number;
  upper: number;
  rate: number;
  taxInBand: number;
}

/** Breakdown of platform commission in a marketplace transaction. */
export interface CommissionBreakdown {
  rate: number;
  amount: number;
  vatOnCommission: number;
  netCommission: number;
}

/** VAT liability assignment in a marketplace transaction. */
export interface VatLiability {
  collectedBy: 'seller' | 'platform';
  amount: number;
  remittedBy: 'seller' | 'platform';
}

/** Line-by-line breakdown of a marketplace transaction. */
export interface TransactionBreakdown {
  saleAmount: number;
  vatAmount: number;
  commissionAmount: number;
  whtAmount: number;
  sellerPayout: number;
  totalFromBuyer: number;
}

/** Per-state payroll summary for batch payroll results. */
export interface StatePayrollSummary {
  stateCode: NigerianState;
  stateName: string;
  irsName: string;
  employeeCount: number;
  totalGross: number;
  totalPaye: number;
  totalPension: number;
  totalNhf: number;
  filingMethods: string[];
  portalUrl: string | null;
  email: string | null;
  address: string | null;
  monthlyRemittanceDeadline: string;
  formH1Deadline: string;
}

/** Aggregate totals across all employees in a payroll batch. */
export interface PayrollTotals {
  totalGross: number;
  totalPaye: number;
  totalPension: number;
  totalNhf: number;
  employeeCount: number;
}

/** Monthly deduction breakdown for an employee. */
export interface MonthlyDeductions {
  paye: number;
  pension: number;
  nhf: number;
  total: number;
}

/** Employer-side cost breakdown per employee. */
export interface EmployerCosts {
  pension: number;
  nsitf: number;
  itf: number;
  total: number;
}

/** Detailed relief breakdown for PAYE calculation. */
export interface ReliefBreakdown {
  consolidatedRelief: number;
  rentRelief: number;
  pensionRelief: number;
  nhfRelief: number;
  total: number;
}

// ─── VAT Module Types ────────────────────────────────────────────────────────

/** Input options for VAT calculation. */
export interface VatCalculateOptions {
  /** Positive Naira amount (2dp). */
  amount: number;
  /** If true, amount is VAT-inclusive (gross). */
  inclusive?: boolean;
  /** Tax category — defaults to 'standard'. */
  category?: TaxCategory;
  /** ISO 8601 date string; determines rate regime. */
  date?: string;
}

/** Result of a VAT calculation. */
export interface VatResult {
  net: number;
  vat: number;
  gross: number;
  rate: number;
  rateType: 'standard' | 'zero-rated' | 'exempt';
  category: TaxCategory;
  legalBasis: string;
  inputVatRecoverable: boolean;
}

// ─── PAYE Module Types ───────────────────────────────────────────────────────

/** Input options for PAYE calculation. */
export interface PayeCalculateOptions {
  grossAnnual: number;
  pensionContributing?: boolean;
  nhfContributing?: boolean;
  rentPaidAnnual?: number;
  disabilityStatus?: boolean;
  taxYear?: number;
}

/** Result of a PAYE calculation. */
export interface PayeResult {
  grossAnnual: number;
  grossMonthly: number;
  pension: { employee: number; employer: number };
  nhf: number;
  reliefs: ReliefBreakdown;
  taxableIncome: number;
  taxBands: TaxBand[];
  annualPaye: number;
  monthlyPaye: number;
  effectiveRate: number;
  exempt: boolean;
  exemptionBasis: string | null;
  netMonthly: number;
  monthlyDeductions: MonthlyDeductions;
  employerCosts: EmployerCosts;
  legalBasis: string;
}

// ─── WHT Module Types ────────────────────────────────────────────────────────

/** Input options for WHT calculation. */
export interface WhtCalculateOptions {
  amount: number;
  payeeType: 'individual' | 'company';
  serviceType: WhtServiceType;
  payeeIsSmallCompany?: boolean;
  payeeTin?: string;
}

/** Result of a WHT calculation. */
export interface WhtResult {
  grossAmount: number;
  rate: number;
  whtAmount: number;
  netPayment: number;
  exempt: boolean;
  exemptionBasis: string | null;
  remittanceDeadline: string;
  creditNoteRequired: boolean;
  legalBasis: string;
}

// ─── Pension Module Types ────────────────────────────────────────────────────

/** Input options for pension calculation. */
export interface PensionCalculateOptions {
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  /** Employee contribution rate — minimum 0.08 (8%). */
  employeeRate?: number;
  /** Employer contribution rate — minimum 0.10 (10%). */
  employerRate?: number;
}

/** Result of a pension calculation. */
export interface PensionResult {
  pensionableEarnings: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  remittanceDeadline: string;
  remittanceMethod: string;
  legalBasis: string;
}

// ─── Marketplace Module Types ────────────────────────────────────────────────

/** Input options for marketplace transaction calculation. */
export interface MarketplaceOptions {
  saleAmount: number;
  /** Commission rate, e.g. 0.10 for 10%. */
  platformCommission: number;
  sellerVatRegistered: boolean;
  buyerType: 'individual' | 'business';
  serviceCategory?: TaxCategory;
  sellerTin?: string;
  platformIsVatAgent?: boolean;
}

/** Result of a marketplace transaction calculation. */
export interface MarketplaceResult {
  saleAmount: number;
  vat: VatResult;
  totalFromBuyer: number;
  platformCommission: CommissionBreakdown;
  sellerPayout: number;
  wht: WhtResult | null;
  vatLiability: VatLiability;
  breakdown: TransactionBreakdown;
}

// ─── Payroll Module Types ────────────────────────────────────────────────────

/** Single employee input for payroll batch calculation. */
export interface EmployeeInput {
  id?: string;
  name: string;
  grossAnnual: number;
  stateOfResidence: NigerianState;
  pensionContributing?: boolean;
  nhfContributing?: boolean;
  rentPaidAnnual?: number;
}

/** Result of a payroll batch calculation. */
export interface PayrollBatchResult {
  employees: (PayeResult & { id?: string; name: string; stateOfResidence: NigerianState })[];
  byState: Partial<Record<NigerianState, StatePayrollSummary>>;
  totals: PayrollTotals;
}
