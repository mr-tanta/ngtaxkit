// ─── Form H1 PDF (Layer 2) ───────────────────────────────────────────────────
// Generates annual Form H1 (PAYE return) PDFs using pdfkit.
// Returns a Buffer, performs no file I/O. Serverless-compatible.

import PDFDocument from 'pdfkit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FormH1Employer {
  name: string;
  tin: string;
  address: string;
  rcNumber?: string;
}

export interface FormH1Employee {
  serialNumber: number;
  name: string;
  tin: string;
  grossIncome: number;
  reliefs: number;
  taxableIncome: number;
  taxDeducted: number;
}

export interface FormH1Options {
  employer: FormH1Employer;
  taxYear: number;
  state: string;
  stateIrsName: string;
  stateIrsAddress: string;
  employees: FormH1Employee[];
  filingDeadline?: string;
}

export interface FormH1 {
  employer: FormH1Employer;
  taxYear: number;
  state: string;
  stateIrsName: string;
  stateIrsAddress: string;
  employees: FormH1Employee[];
  filingDeadline: string;
  totals: {
    grossIncome: number;
    reliefs: number;
    taxableIncome: number;
    taxDeducted: number;
  };
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
 * Generate a FormH1 object from options.
 * Computes totals across all employees and sets filing deadline.
 */
export function generate(options: FormH1Options): FormH1 {
  const totals = {
    grossIncome: 0,
    reliefs: 0,
    taxableIncome: 0,
    taxDeducted: 0,
  };

  for (const emp of options.employees) {
    totals.grossIncome = bankersRound2(totals.grossIncome + emp.grossIncome);
    totals.reliefs = bankersRound2(totals.reliefs + emp.reliefs);
    totals.taxableIncome = bankersRound2(totals.taxableIncome + emp.taxableIncome);
    totals.taxDeducted = bankersRound2(totals.taxDeducted + emp.taxDeducted);
  }

  const filingDeadline = options.filingDeadline ?? `${options.taxYear + 1}-01-31`;

  return {
    employer: options.employer,
    taxYear: options.taxYear,
    state: options.state,
    stateIrsName: options.stateIrsName,
    stateIrsAddress: options.stateIrsAddress,
    employees: options.employees,
    filingDeadline,
    totals,
  };
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a Form H1 PDF as a Buffer.
 * Renders: employer details, employee table (S/N, Name, TIN, Gross, Reliefs,
 * Taxable, Tax Deducted), totals, state IRS info, filing deadline.
 */
export function toPDF(form: FormH1): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      layout: 'landscape',
      info: {
        Title: `Form H1 - ${form.employer.name} - ${form.taxYear}`,
        Author: form.employer.name,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const landscapeWidth = 841.89 - PAGE_MARGIN * 2;

    // ── Title ──
    doc.font(FONT_BOLD).fontSize(14).fillColor(COLOR_PRIMARY)
      .text('FORM H1 — ANNUAL TAX DEDUCTION CARD', PAGE_MARGIN, PAGE_MARGIN, {
        align: 'center', width: landscapeWidth,
      });

    doc.moveDown(0.5);
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY)
      .text(`Tax Year: ${form.taxYear}`, { align: 'center', width: landscapeWidth });

    doc.moveDown(1);

    // ── Employer Details ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Employer Details');
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    doc.text(`Name: ${form.employer.name}`);
    doc.text(`TIN: ${form.employer.tin}`);
    doc.text(`Address: ${form.employer.address}`);
    if (form.employer.rcNumber) doc.text(`RC Number: ${form.employer.rcNumber}`);

    doc.moveDown(0.8);

    // ── State IRS Info ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('State IRS');
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    doc.text(`${form.stateIrsName}`);
    doc.text(`${form.stateIrsAddress}`);
    doc.text(`Filing Deadline: ${formatDate(form.filingDeadline)}`);

    doc.moveDown(1);

    // ── Employee Table ──
    const cols = [
      { label: 'S/N', x: PAGE_MARGIN, w: 35, align: 'left' as const },
      { label: 'Name', x: PAGE_MARGIN + 40, w: 140, align: 'left' as const },
      { label: 'TIN', x: PAGE_MARGIN + 185, w: 100, align: 'left' as const },
      { label: 'Gross Income', x: PAGE_MARGIN + 290, w: 100, align: 'right' as const },
      { label: 'Reliefs', x: PAGE_MARGIN + 395, w: 90, align: 'right' as const },
      { label: 'Taxable Income', x: PAGE_MARGIN + 490, w: 100, align: 'right' as const },
      { label: 'Tax Deducted', x: PAGE_MARGIN + 595, w: 100, align: 'right' as const },
    ];

    // Header row
    const headerY = doc.y;
    doc.rect(PAGE_MARGIN, headerY, landscapeWidth, 18).fill(COLOR_HEADER_BG);
    doc.font(FONT_BOLD).fontSize(7).fillColor(COLOR_PRIMARY);
    for (const col of cols) {
      doc.text(col.label, col.x, headerY + 5, { width: col.w, align: col.align });
    }
    doc.y = headerY + 22;

    // Data rows
    doc.font(FONT_REGULAR).fontSize(7).fillColor(COLOR_SECONDARY);
    for (const emp of form.employees) {
      if (doc.y > 520) { doc.addPage(); doc.y = PAGE_MARGIN; }
      const y = doc.y;
      doc.text(String(emp.serialNumber), cols[0].x, y, { width: cols[0].w, align: cols[0].align });
      doc.text(emp.name, cols[1].x, y, { width: cols[1].w, align: cols[1].align });
      doc.text(emp.tin, cols[2].x, y, { width: cols[2].w, align: cols[2].align });
      doc.text(formatCurrency(emp.grossIncome), cols[3].x, y, { width: cols[3].w, align: cols[3].align });
      doc.text(formatCurrency(emp.reliefs), cols[4].x, y, { width: cols[4].w, align: cols[4].align });
      doc.text(formatCurrency(emp.taxableIncome), cols[5].x, y, { width: cols[5].w, align: cols[5].align });
      doc.text(formatCurrency(emp.taxDeducted), cols[6].x, y, { width: cols[6].w, align: cols[6].align });
      doc.y = y + 14;
    }

    // Totals row
    doc.moveDown(0.3);
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + landscapeWidth, doc.y)
      .strokeColor(COLOR_LINE).lineWidth(0.5).stroke();
    doc.y += 4;

    const totY = doc.y;
    doc.font(FONT_BOLD).fontSize(7).fillColor(COLOR_PRIMARY);
    doc.text('TOTALS', cols[0].x, totY, { width: cols[1].w + cols[0].w + 5, align: 'left' });
    doc.text(formatCurrency(form.totals.grossIncome), cols[3].x, totY, { width: cols[3].w, align: cols[3].align });
    doc.text(formatCurrency(form.totals.reliefs), cols[4].x, totY, { width: cols[4].w, align: cols[4].align });
    doc.text(formatCurrency(form.totals.taxableIncome), cols[5].x, totY, { width: cols[5].w, align: cols[5].align });
    doc.text(formatCurrency(form.totals.taxDeducted), cols[6].x, totY, { width: cols[6].w, align: cols[6].align });

    doc.moveDown(2);

    // ── Footer ──
    doc.font(FONT_REGULAR).fontSize(7).fillColor(COLOR_SECONDARY)
      .text(
        'This Form H1 is generated in compliance with the Personal Income Tax Act (PITA) as amended by NTA 2025. ' +
        'Employers are required to file this return with the relevant State Internal Revenue Service.',
        PAGE_MARGIN, doc.y, { width: landscapeWidth },
      );

    doc.end();
  });
}

// ─── LIRS Format ─────────────────────────────────────────────────────────────

/**
 * Convert a FormH1 to Lagos IRS e-filing portal compatible format.
 * Returns a plain object suitable for JSON serialization.
 */
export function toLIRSFormat(form: FormH1): object {
  return {
    formType: 'H1',
    taxYear: form.taxYear,
    employer: {
      name: form.employer.name,
      tin: form.employer.tin,
      address: form.employer.address,
      rcNumber: form.employer.rcNumber ?? null,
    },
    state: form.state,
    filingDeadline: form.filingDeadline,
    employees: form.employees.map((emp) => ({
      sn: emp.serialNumber,
      name: emp.name,
      tin: emp.tin,
      grossIncome: emp.grossIncome,
      reliefs: emp.reliefs,
      taxableIncome: emp.taxableIncome,
      taxDeducted: emp.taxDeducted,
    })),
    totals: {
      grossIncome: form.totals.grossIncome,
      reliefs: form.totals.reliefs,
      taxableIncome: form.totals.taxableIncome,
      taxDeducted: form.totals.taxDeducted,
    },
    employeeCount: form.employees.length,
  };
}
