// ─── WHT Credit Note PDF (Layer 2) ───────────────────────────────────────────
// Generates WHT credit note PDFs using pdfkit — no headless browser required.
// Returns a Buffer, performs no file I/O. Serverless-compatible.

import PDFDocument from 'pdfkit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhtCreditNoteParty {
  name: string;
  tin: string;
  address: string;
}

export interface WhtCreditNoteOptions {
  deductor: WhtCreditNoteParty;
  beneficiary: WhtCreditNoteParty;
  grossAmount: number;
  whtRate: number;
  whtAmount: number;
  netPayment: number;
  serviceDescription: string;
  paymentDate: string;
  creditNoteNumber: string;
  remittanceReceiptNumber?: string;
  legalBasis?: string;
}

export interface WhtCreditNote {
  deductor: WhtCreditNoteParty;
  beneficiary: WhtCreditNoteParty;
  grossAmount: number;
  whtRate: number;
  whtAmount: number;
  netPayment: number;
  serviceDescription: string;
  paymentDate: string;
  creditNoteNumber: string;
  remittanceReceiptNumber?: string;
  legalBasis: string;
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


// ─── Layout Constants ────────────────────────────────────────────────────────

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FONT_BOLD = 'Helvetica-Bold';
const FONT_REGULAR = 'Helvetica';
const COLOR_PRIMARY = '#1a1a2e';
const COLOR_SECONDARY = '#555555';
const COLOR_LINE = '#cccccc';

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a WhtCreditNote from options.
 * Validates and populates all required fields including legal basis.
 */
export function create(options: WhtCreditNoteOptions): WhtCreditNote {
  return {
    deductor: options.deductor,
    beneficiary: options.beneficiary,
    grossAmount: options.grossAmount,
    whtRate: options.whtRate,
    whtAmount: options.whtAmount,
    netPayment: options.netPayment,
    serviceDescription: options.serviceDescription,
    paymentDate: options.paymentDate,
    creditNoteNumber: options.creditNoteNumber,
    remittanceReceiptNumber: options.remittanceReceiptNumber,
    legalBasis: options.legalBasis ?? 'WHT Regulations 2024; NTA 2025 Part IV',
  };
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a WHT Credit Note PDF as a Buffer.
 * Renders: deductor TIN, beneficiary TIN, gross amount, WHT rate,
 * WHT amount, net payment, remittance receipt number, legal basis.
 */
export function toPDF(note: WhtCreditNote): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: {
        Title: `WHT Credit Note ${note.creditNoteNumber}`,
        Author: note.deductor.name,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ── Header ──
    doc
      .font(FONT_BOLD).fontSize(14).fillColor(COLOR_PRIMARY)
      .text('WHT CREDIT NOTE', PAGE_MARGIN, PAGE_MARGIN, { align: 'center', width: CONTENT_WIDTH });

    doc.moveDown(0.5);
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY)
      .text(`Credit Note #: ${note.creditNoteNumber}`, { align: 'center', width: CONTENT_WIDTH });
    doc.text(`Payment Date: ${formatDate(note.paymentDate)}`, { align: 'center', width: CONTENT_WIDTH });

    doc.moveDown(1);

    // ── Deductor Details ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Deductor (Payer)');
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    doc.text(`Name: ${note.deductor.name}`);
    doc.text(`TIN: ${note.deductor.tin}`);
    doc.text(`Address: ${note.deductor.address}`);

    doc.moveDown(0.8);

    // ── Beneficiary Details ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Beneficiary (Payee)');
    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    doc.text(`Name: ${note.beneficiary.name}`);
    doc.text(`TIN: ${note.beneficiary.tin}`);
    doc.text(`Address: ${note.beneficiary.address}`);

    doc.moveDown(1);

    // ── Payment Details ──
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY).text('Payment Details');
    doc.moveDown(0.3);

    const detailsX = PAGE_MARGIN;
    const valueX = PAGE_MARGIN + 200;

    const rows: [string, string][] = [
      ['Service Description:', note.serviceDescription],
      ['Gross Amount:', formatCurrency(note.grossAmount)],
      ['WHT Rate:', `${(note.whtRate * 100).toFixed(1)}%`],
      ['WHT Amount:', formatCurrency(note.whtAmount)],
      ['Net Payment:', formatCurrency(note.netPayment)],
    ];

    if (note.remittanceReceiptNumber) {
      rows.push(['NRS Remittance Receipt #:', note.remittanceReceiptNumber]);
    }

    doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
    for (const [label, value] of rows) {
      const y = doc.y;
      doc.font(FONT_BOLD).text(label, detailsX, y, { continued: false });
      doc.font(FONT_REGULAR).text(value, valueX, y);
    }

    doc.moveDown(1.5);

    // ── Legal Basis ──
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(COLOR_LINE).lineWidth(0.5).stroke();
    doc.y += 8;

    doc.font(FONT_REGULAR).fontSize(7).fillColor(COLOR_SECONDARY)
      .text(`Legal Basis: ${note.legalBasis}`, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(0.5);
    doc.text(
      'This credit note certifies that Withholding Tax has been deducted and will be remitted to the Nigeria Revenue Service (NRS) on behalf of the beneficiary.',
      PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH },
    );

    doc.end();
  });
}
