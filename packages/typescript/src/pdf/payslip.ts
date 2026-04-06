// ─── Payslip PDF (Layer 2) ───────────────────────────────────────────────────
// Generates employee payslip PDFs using pdfkit.
// Returns a Buffer, performs no file I/O. Serverless-compatible.

import PDFDocument from 'pdfkit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PayslipEmployer {
  name: string;
  address: string;
  tin: string;
}

export interface PayslipEmployee {
  name: string;
  employeeId: string;
  tin: string;
  department?: string;
}

export interface PayslipEarning {
  label: string;
  amount: number;
}

export interface PayslipDeduction {
  label: string;
  amount: number;
}

export interface PayslipEmployerContribution {
  label: string;
  amount: number;
}

export interface PayslipOptions {
  employer: PayslipEmployer;
  employee: PayslipEmployee;
  payPeriod: string;
  payDate: string;
  earnings: PayslipEarning[];
  deductions: PayslipDeduction[];
  employerContributions?: PayslipEmployerContribution[];
}

export interface Payslip {
  employer: PayslipEmployer;
  employee: PayslipEmployee;
  payPeriod: string;
  payDate: string;
  earnings: PayslipEarning[];
  deductions: PayslipDeduction[];
  employerContributions: PayslipEmployerContribution[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}


// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, decimal] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${sign}\u20A6${withCommas}.${decimal}`;
}

function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function bankersRound2(value: number): number {
  const shifted = value * 100;
  const floored = Math.floor(shifted);
  const remainder = shifted - floored;
  const epsilon = 1e-9;
  if (Math.abs(remainder - 0.5) < epsilon) {
    return (floored % 2 === 0 ? floored : floored + 1) / 100;
  }
  return Math.round(shifted) / 100;
}

// ─── Layout Constants ────────────────────────────────────────────────────────

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FONT_BOLD = 'Helvetica-Bold';
const FONT_REGULAR = 'Helvetica';
const COLOR_PRIMARY = '#1a1a2e';
const COLOR_SECONDARY = '#555555';
const COLOR_HEADER_BG = '#f0f0f0';
const COLOR_LINE = '#cccccc';

// ─── Generate ────────────────────────────────────────────────────────────────

/**
 * Generate a Payslip object from options.
 * Computes gross earnings, total deductions, and net pay.
 */
export function generate(options: PayslipOptions): Payslip {
  const grossEarnings = bankersRound2(
    options.earnings.reduce((sum, e) => sum + e.amount, 0),
  );
  const totalDeductions = bankersRound2(
    options.deductions.reduce((sum, d) => sum + d.amount, 0),
  );
  const netPay = bankersRound2(grossEarnings - totalDeductions);

  return {
    employer: options.employer,
    employee: options.employee,
    payPeriod: options.payPeriod,
    payDate: options.payDate,
    earnings: options.earnings,
    deductions: options.deductions,
    employerContributions: options.employerContributions ?? [],
    grossEarnings,
    totalDeductions,
    netPay,
  };
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a Payslip PDF as a Buffer.
 * Renders: company header, employee details, earnings table, deductions table,
 * summary (gross, deductions, net), employer contributions.
 */
export function toPDF(slip: Payslip): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: {
        Title: `Payslip - ${slip.employee.name} - ${slip.payPeriod}`,
        Author: slip.employer.name,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ── Company Header ──
    doc.font(FONT_BOLD).fontSize(14).fillColor(COLOR_PRIMARY)
      .text(slip.employer.name, PAGE_MARGIN, PAGE_MARGIN);
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY)
      .text(slip.employer.address)
      .text(`TIN: ${slip.employer.tin}`);

    doc.moveDown(0.8);

    // ── PAYSLIP Banner ──
    const bannerY = doc.y;
    doc.rect(PAGE_MARGIN, bannerY, CONTENT_WIDTH, 24).fill(COLOR_PRIMARY);
    doc.font(FONT_BOLD).fontSize(12).fillColor('#ffffff')
      .text('PAYSLIP', PAGE_MARGIN + 10, bannerY + 6, { width: CONTENT_WIDTH - 20 });
    doc.y = bannerY + 32;

    // ── Employee Details ──
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    doc.text(`Employee: ${slip.employee.name}`);
    doc.text(`Employee ID: ${slip.employee.employeeId}`);
    doc.text(`TIN: ${slip.employee.tin}`);
    if (slip.employee.department) doc.text(`Department: ${slip.employee.department}`);
    doc.text(`Pay Period: ${slip.payPeriod}`);
    doc.text(`Pay Date: ${formatDate(slip.payDate)}`);

    doc.moveDown(1);

    // ── Earnings Table ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Earnings');
    doc.moveDown(0.3);
    renderTable(doc, slip.earnings.map((e) => [e.label, formatCurrency(e.amount)]));

    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_PRIMARY)
      .text(`Gross Earnings: ${formatCurrency(slip.grossEarnings)}`);

    doc.moveDown(1);

    // ── Deductions Table ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Deductions');
    doc.moveDown(0.3);
    renderTable(doc, slip.deductions.map((d) => [d.label, formatCurrency(d.amount)]));

    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_PRIMARY)
      .text(`Total Deductions: ${formatCurrency(slip.totalDeductions)}`);

    doc.moveDown(1);

    // ── Summary ──
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(COLOR_LINE).lineWidth(1).stroke();
    doc.y += 8;

    doc.font(FONT_BOLD).fontSize(12).fillColor(COLOR_PRIMARY)
      .text(`Net Pay: ${formatCurrency(slip.netPay)}`);

    doc.moveDown(1);

    // ── Employer Contributions ──
    if (slip.employerContributions.length > 0) {
      doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Employer Contributions');
      doc.moveDown(0.3);
      renderTable(doc, slip.employerContributions.map((c) => [c.label, formatCurrency(c.amount)]));
    }

    doc.moveDown(1.5);

    // ── Footer ──
    doc.font(FONT_REGULAR).fontSize(7).fillColor(COLOR_SECONDARY)
      .text(
        'This payslip is generated in compliance with the Nigeria Tax Act (NTA) 2025, ' +
        'Pension Reform Act (PRA) 2014, and applicable statutory deduction regulations.',
        PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH },
      );

    doc.end();
  });
}

function renderTable(doc: PDFKit.PDFDocument, rows: [string, string][]): void {
  const labelX = PAGE_MARGIN + 10;
  const valueX = PAGE_MARGIN + 300;

  doc.font(FONT_REGULAR).fontSize(8).fillColor(COLOR_SECONDARY);
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { width: 150, align: 'right' });
    doc.y = y + 14;
  }
}
