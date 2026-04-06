import { describe, it, expect } from 'vitest';
import { create as createWhtCreditNote, toPDF as whtToPDF } from './wht-credit-note';
import { generate as generateFormH1, toPDF as h1ToPDF, toLIRSFormat } from './form-h1';
import { generate as generatePayslip, toPDF as payslipToPDF } from './payslip';
import { generate as generateVatReturn, toPDF as vatReturnToPDF, toNRSFormat } from './vat-return';

// ─── WHT Credit Note Tests ──────────────────────────────────────────────────

describe('WHT Credit Note', () => {
  const note = createWhtCreditNote({
    deductor: { name: 'Platform Ltd', tin: '11111111-0001', address: '1 Lagos Rd' },
    beneficiary: { name: 'Seller Inc', tin: '22222222-0001', address: '2 Abuja Ave' },
    grossAmount: 1_000_000,
    whtRate: 0.10,
    whtAmount: 100_000,
    netPayment: 900_000,
    serviceDescription: 'Professional services',
    paymentDate: '2026-03-15',
    creditNoteNumber: 'WHT-CN-001',
    remittanceReceiptNumber: 'NRS-REC-12345',
  });

  it('creates a WhtCreditNote with correct fields', () => {
    expect(note.deductor.tin).toBe('11111111-0001');
    expect(note.beneficiary.tin).toBe('22222222-0001');
    expect(note.grossAmount).toBe(1_000_000);
    expect(note.whtRate).toBe(0.10);
    expect(note.whtAmount).toBe(100_000);
    expect(note.netPayment).toBe(900_000);
    expect(note.remittanceReceiptNumber).toBe('NRS-REC-12345');
    expect(note.legalBasis).toContain('WHT Regulations 2024');
  });

  it('generates a valid PDF Buffer', async () => {
    const pdf = await whtToPDF(note);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

// ─── Form H1 Tests ──────────────────────────────────────────────────────────

describe('Form H1', () => {
  const form = generateFormH1({
    employer: { name: 'Acme Nigeria Ltd', tin: '33333333-0001', address: '3 Victoria Island' },
    taxYear: 2025,
    state: 'Lagos',
    stateIrsName: 'Lagos Internal Revenue Service (LIRS)',
    stateIrsAddress: 'Alausa, Ikeja, Lagos',
    employees: [
      { serialNumber: 1, name: 'Ade Obi', tin: 'T001', grossIncome: 5_000_000, reliefs: 1_200_000, taxableIncome: 3_800_000, taxDeducted: 600_000 },
      { serialNumber: 2, name: 'Bola Eze', tin: 'T002', grossIncome: 3_000_000, reliefs: 800_000, taxableIncome: 2_200_000, taxDeducted: 300_000 },
    ],
  });

  it('generates a FormH1 with computed totals', () => {
    expect(form.totals.grossIncome).toBe(8_000_000);
    expect(form.totals.reliefs).toBe(2_000_000);
    expect(form.totals.taxableIncome).toBe(6_000_000);
    expect(form.totals.taxDeducted).toBe(900_000);
    expect(form.filingDeadline).toBe('2026-01-31');
  });

  it('generates a valid PDF Buffer', async () => {
    const pdf = await h1ToPDF(form);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('toLIRSFormat returns correct structure', () => {
    const lirs = toLIRSFormat(form) as Record<string, unknown>;
    expect(lirs.formType).toBe('H1');
    expect(lirs.taxYear).toBe(2025);
    expect(lirs.state).toBe('Lagos');
    expect(lirs.employeeCount).toBe(2);
    expect(lirs.totals).toEqual({
      grossIncome: 8_000_000,
      reliefs: 2_000_000,
      taxableIncome: 6_000_000,
      taxDeducted: 900_000,
    });
    const employees = lirs.employees as Array<Record<string, unknown>>;
    expect(employees).toHaveLength(2);
    expect(employees[0].sn).toBe(1);
    expect(employees[0].name).toBe('Ade Obi');
  });
});


// ─── Payslip Tests ──────────────────────────────────────────────────────────

describe('Payslip', () => {
  const slip = generatePayslip({
    employer: { name: 'Acme Nigeria Ltd', address: '3 Victoria Island', tin: '33333333-0001' },
    employee: { name: 'Ade Obi', employeeId: 'EMP-001', tin: 'T001', department: 'Engineering' },
    payPeriod: '2026-03',
    payDate: '2026-03-28',
    earnings: [
      { label: 'Basic Salary', amount: 250_000 },
      { label: 'Housing Allowance', amount: 100_000 },
      { label: 'Transport Allowance', amount: 50_000 },
    ],
    deductions: [
      { label: 'PAYE', amount: 35_000 },
      { label: 'Pension (Employee)', amount: 32_000 },
      { label: 'NHF', amount: 6_250 },
    ],
    employerContributions: [
      { label: 'Pension (Employer)', amount: 40_000 },
      { label: 'NSITF', amount: 4_000 },
    ],
  });

  it('generates a Payslip with correct summary', () => {
    expect(slip.grossEarnings).toBe(400_000);
    expect(slip.totalDeductions).toBe(73_250);
    expect(slip.netPay).toBe(326_750);
    expect(slip.employerContributions).toHaveLength(2);
  });

  it('generates a valid PDF Buffer', async () => {
    const pdf = await payslipToPDF(slip);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

// ─── VAT Return Tests ───────────────────────────────────────────────────────

describe('VAT Return', () => {
  const ret = generateVatReturn({
    period: '2026-03',
    businessName: 'Acme Nigeria Ltd',
    businessTin: '33333333-0001',
    businessVrn: 'VRN-001',
    salesInvoices: [
      { invoiceNumber: 'INV-001', amount: 500_000, vatAmount: 37_500, rateType: 'standard' },
      { invoiceNumber: 'INV-002', amount: 200_000, vatAmount: 0, rateType: 'zero-rated' },
      { invoiceNumber: 'INV-003', amount: 100_000, vatAmount: 0, rateType: 'exempt' },
    ],
    purchaseInvoices: [
      { invoiceNumber: 'PUR-001', amount: 300_000, vatAmount: 22_500, rateType: 'standard' },
    ],
  });

  it('generates a VatReturn with correct computations', () => {
    expect(ret.outputVat).toBe(37_500);
    expect(ret.inputVat).toBe(22_500);
    expect(ret.netVatPayable).toBe(15_000);
    expect(ret.standardRatedSales).toBe(500_000);
    expect(ret.zeroRatedSales).toBe(200_000);
    expect(ret.exemptSales).toBe(100_000);
    expect(ret.invoiceCount).toBe(4);
    expect(ret.filingDeadline).toBe('2026-04-21');
  });

  it('computes filing deadline across year boundary', () => {
    const decRet = generateVatReturn({
      period: '2026-12',
      businessName: 'Test',
      businessTin: 'T1',
      businessVrn: 'V1',
      salesInvoices: [{ invoiceNumber: 'X', amount: 100, vatAmount: 7.5, rateType: 'standard' }],
    });
    expect(decRet.filingDeadline).toBe('2027-01-21');
  });

  it('generates a valid PDF Buffer', async () => {
    const pdf = await vatReturnToPDF(ret);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('toNRSFormat returns correct structure', () => {
    const nrs = toNRSFormat(ret) as Record<string, unknown>;
    expect(nrs.formType).toBe('VAT_RETURN');
    expect(nrs.period).toBe('2026-03');
    expect(nrs.outputVat).toBe(37_500);
    expect(nrs.inputVat).toBe(22_500);
    expect(nrs.netVatPayable).toBe(15_000);
    expect(nrs.invoiceCount).toBe(4);

    const biz = nrs.business as Record<string, unknown>;
    expect(biz.tin).toBe('33333333-0001');
    expect(biz.vrn).toBe('VRN-001');

    const breakdown = nrs.salesBreakdown as Record<string, unknown>;
    expect(breakdown.standardRated).toBe(500_000);
    expect(breakdown.zeroRated).toBe(200_000);
    expect(breakdown.exempt).toBe(100_000);

    const sales = nrs.salesInvoices as Array<Record<string, unknown>>;
    expect(sales).toHaveLength(3);
    const purchases = nrs.purchaseInvoices as Array<Record<string, unknown>>;
    expect(purchases).toHaveLength(1);
  });
});
