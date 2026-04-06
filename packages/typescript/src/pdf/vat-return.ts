// ─── VAT Return PDF (Layer 2) ────────────────────────────────────────────────
// Generates VAT return summary PDFs using pdfkit.
// Returns a Buffer, performs no file I/O. Serverless-compatible.

import PDFDocument from 'pdfkit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VatReturnInvoice {
  invoiceNumber: string;
  amount: number;
  vatAmount: number;
  rateType: 'standard' | 'zero-rated' | 'exempt';
}

export interface VatReturnOptions {
  period: string; // YYYY-MM
  businessName: string;
  businessTin: string;
  businessVrn: string;
  salesInvoices: VatReturnInvoice[];
  purchaseInvoices?: VatReturnInvoice[];
}

export interface VatReturn {
  period: string;
  businessName: string;
  businessTin: string;
  businessVrn: string;
  outputVat: number;
  inputVat: number;
  netVatPayable: number;
  standardRatedSales: number;
  zeroRatedSales: number;
  exemptSales: number;
  invoiceCount: number;
  filingDeadline: string;
  salesInvoices: VatReturnInvoice[];
  purchaseInvoices: VatReturnInvoice[];
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

/**
 * Compute the filing deadline: 21st of the month following the period.
 */
function computeFilingDeadline(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}-21`;
}

// ─── Layout Constants ────────────────────────────────────────────────────────

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FONT_BOLD = 'Helvetica-Bold';
const FONT_REGULAR = 'Helvetica';
const COLOR_PRIMARY = '#1a1a2e';
const COLOR_SECONDARY = '#555555';
const COLOR_LINE = '#cccccc';

// ─── Generate ────────────────────────────────────────────────────────────────

/**
 * Generate a VatReturn object from options.
 * Computes output VAT, input VAT, net VAT payable, breakdown by rate type,
 * invoice count, and filing deadline.
 */
export function generate(options: VatReturnOptions): VatReturn {
  const purchaseInvoices = options.purchaseInvoices ?? [];

  let outputVat = 0;
  let standardRatedSales = 0;
  let zeroRatedSales = 0;
  let exemptSales = 0;

  for (const inv of options.salesInvoices) {
    outputVat = bankersRound2(outputVat + inv.vatAmount);
    if (inv.rateType === 'standard') {
      standardRatedSales = bankersRound2(standardRatedSales + inv.amount);
    } else if (inv.rateType === 'zero-rated') {
      zeroRatedSales = bankersRound2(zeroRatedSales + inv.amount);
    } else {
      exemptSales = bankersRound2(exemptSales + inv.amount);
    }
  }

  let inputVat = 0;
  for (const inv of purchaseInvoices) {
    inputVat = bankersRound2(inputVat + inv.vatAmount);
  }

  const netVatPayable = bankersRound2(outputVat - inputVat);
  const invoiceCount = options.salesInvoices.length + purchaseInvoices.length;
  const filingDeadline = computeFilingDeadline(options.period);

  return {
    period: options.period,
    businessName: options.businessName,
    businessTin: options.businessTin,
    businessVrn: options.businessVrn,
    outputVat,
    inputVat,
    netVatPayable,
    standardRatedSales,
    zeroRatedSales,
    exemptSales,
    invoiceCount,
    filingDeadline,
    salesInvoices: options.salesInvoices,
    purchaseInvoices,
  };
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a VAT Return summary PDF as a Buffer.
 * Renders: business details, period, output VAT, input VAT, net VAT payable,
 * breakdown by rate type, invoice count, filing deadline.
 */
export function toPDF(ret: VatReturn): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: {
        Title: `VAT Return - ${ret.businessName} - ${ret.period}`,
        Author: ret.businessName,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ── Title ──
    doc.font(FONT_BOLD).fontSize(14).fillColor(COLOR_PRIMARY)
      .text('VAT RETURN SUMMARY', PAGE_MARGIN, PAGE_MARGIN, {
        align: 'center', width: CONTENT_WIDTH,
      });

    doc.moveDown(0.5);
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY)
      .text(`Period: ${ret.period}`, { align: 'center', width: CONTENT_WIDTH });
    doc.text(`Filing Deadline: ${formatDate(ret.filingDeadline)}`, { align: 'center', width: CONTENT_WIDTH });

    doc.moveDown(1);

    // ── Business Details ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Business Details');
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    doc.text(`Name: ${ret.businessName}`);
    doc.text(`TIN: ${ret.businessTin}`);
    doc.text(`VRN: ${ret.businessVrn}`);

    doc.moveDown(1);

    // ── VAT Summary ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('VAT Summary');
    doc.moveDown(0.3);

    const labelX = PAGE_MARGIN + 10;
    const valueX = PAGE_MARGIN + 280;

    const summaryRows: [string, string][] = [
      ['Output VAT (on sales):', formatCurrency(ret.outputVat)],
      ['Input VAT (on purchases):', formatCurrency(ret.inputVat)],
      ['Net VAT Payable:', formatCurrency(ret.netVatPayable)],
    ];

    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    for (const [label, value] of summaryRows) {
      const y = doc.y;
      doc.text(label, labelX, y);
      doc.font(FONT_BOLD).text(value, valueX, y, { width: 180, align: 'right' });
      doc.font(FONT_REGULAR);
      doc.y = y + 16;
    }

    doc.moveDown(1);

    // ── Breakdown by Rate Type ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Sales Breakdown by Rate Type');
    doc.moveDown(0.3);

    const breakdownRows: [string, string][] = [
      ['Standard-rated sales:', formatCurrency(ret.standardRatedSales)],
      ['Zero-rated sales:', formatCurrency(ret.zeroRatedSales)],
      ['Exempt sales:', formatCurrency(ret.exemptSales)],
      ['Total invoices:', String(ret.invoiceCount)],
    ];

    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    for (const [label, value] of breakdownRows) {
      const y = doc.y;
      doc.text(label, labelX, y);
      doc.text(value, valueX, y, { width: 180, align: 'right' });
      doc.y = y + 16;
    }

    doc.moveDown(2);

    // ── Footer ──
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(COLOR_LINE).lineWidth(0.5).stroke();
    doc.y += 8;

    doc.font(FONT_REGULAR).fontSize(7).fillColor(COLOR_SECONDARY)
      .text(
        'This VAT return summary is generated in compliance with the Nigeria Tax Act (NTA) 2025 and VAT Act as amended. ' +
        'VAT returns must be filed with the Nigeria Revenue Service (NRS) by the 21st of the month following the taxable period.',
        PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH },
      );

    doc.end();
  });
}

// ─── NRS Format ──────────────────────────────────────────────────────────────

/**
 * Convert a VatReturn to NRS-compatible filing format.
 * Returns a plain object suitable for JSON serialization.
 */
export function toNRSFormat(ret: VatReturn): object {
  return {
    formType: 'VAT_RETURN',
    period: ret.period,
    filingDeadline: ret.filingDeadline,
    business: {
      name: ret.businessName,
      tin: ret.businessTin,
      vrn: ret.businessVrn,
    },
    outputVat: ret.outputVat,
    inputVat: ret.inputVat,
    netVatPayable: ret.netVatPayable,
    salesBreakdown: {
      standardRated: ret.standardRatedSales,
      zeroRated: ret.zeroRatedSales,
      exempt: ret.exemptSales,
    },
    invoiceCount: ret.invoiceCount,
    salesInvoices: ret.salesInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      vatAmount: inv.vatAmount,
      rateType: inv.rateType,
    })),
    purchaseInvoices: ret.purchaseInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      vatAmount: inv.vatAmount,
      rateType: inv.rateType,
    })),
  };
}
