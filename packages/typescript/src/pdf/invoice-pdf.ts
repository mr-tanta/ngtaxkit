// ─── Invoice PDF Generation (Layer 2) ────────────────────────────────────────
// Generates professional PDF invoices using pdfkit — no headless browser required.
// Returns a Buffer, performs no file I/O. Serverless-compatible.

import PDFDocument from 'pdfkit';
import type { Invoice } from '../invoice';

// ─── Formatting Helpers ──────────────────────────────────────────────────────

/** Format a number as Nigerian Naira: ₦X,XXX,XXX.XX */
function formatCurrency(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, decimal] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${sign}\u20A6${withCommas}.${decimal}`;
}

/** Format ISO date (YYYY-MM-DD) as DD/MM/YYYY */
function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ─── Layout Constants ────────────────────────────────────────────────────────

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const FONT_BOLD = 'Helvetica-Bold';
const FONT_REGULAR = 'Helvetica';

const COLOR_PRIMARY = '#1a1a2e';
const COLOR_SECONDARY = '#555555';
const COLOR_HEADER_BG = '#f0f0f0';
const COLOR_LINE = '#cccccc';

// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a PDF invoice as a Buffer.
 * Renders: letterhead, TAX INVOICE header, buyer details, line items table,
 * VAT breakdown, payment instructions, and footer with legal references.
 */
export function toPDF(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: invoice.seller.name,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ── Letterhead Area ──
    renderLetterhead(doc, invoice);

    // ── TAX INVOICE Header ──
    renderInvoiceHeader(doc, invoice);

    // ── Buyer Details ──
    renderBuyerDetails(doc, invoice);

    // ── Line Items Table ──
    renderLineItems(doc, invoice);

    // ── VAT Breakdown Summary ──
    renderVatBreakdown(doc, invoice);

    // ── Payment Instructions ──
    renderPaymentInstructions(doc, invoice);

    // ── Footer ──
    renderFooter(doc, invoice);

    doc.end();
  });
}


// ─── Render Sections ─────────────────────────────────────────────────────────

function renderLetterhead(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  doc
    .font(FONT_BOLD)
    .fontSize(16)
    .fillColor(COLOR_PRIMARY)
    .text(invoice.seller.name, PAGE_MARGIN, PAGE_MARGIN);

  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR_SECONDARY)
    .text(invoice.seller.address, PAGE_MARGIN, doc.y + 2)
    .text(`TIN: ${invoice.seller.tin}`);

  if (invoice.seller.vrn) {
    doc.text(`VRN: ${invoice.seller.vrn}`);
  }

  doc.moveDown(1);
}

function renderInvoiceHeader(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  const y = doc.y;

  // "TAX INVOICE" banner
  doc
    .rect(PAGE_MARGIN, y, CONTENT_WIDTH, 28)
    .fill(COLOR_PRIMARY);

  doc
    .font(FONT_BOLD)
    .fontSize(14)
    .fillColor('#ffffff')
    .text('TAX INVOICE', PAGE_MARGIN + 10, y + 7, { width: CONTENT_WIDTH - 20 });

  doc.y = y + 38;

  // Invoice metadata
  const metaY = doc.y;
  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR_SECONDARY);

  const typeLabel = invoice.type === 'credit-note' ? 'CREDIT NOTE' :
                    invoice.type === 'debit-note' ? 'DEBIT NOTE' : 'INVOICE';

  doc.text(`${typeLabel} #: ${invoice.invoiceNumber}`, PAGE_MARGIN, metaY);
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, PAGE_MARGIN, doc.y + 1);
  if (invoice.dueDate) {
    doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, PAGE_MARGIN, doc.y + 1);
  }
  doc.text(`Currency: ${invoice.currency}`, PAGE_MARGIN, doc.y + 1);
  if (invoice.purchaseOrderRef) {
    doc.text(`PO Ref: ${invoice.purchaseOrderRef}`, PAGE_MARGIN, doc.y + 1);
  }

  doc.moveDown(1);
}

function renderBuyerDetails(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(COLOR_PRIMARY)
    .text('Bill To:', PAGE_MARGIN, doc.y);

  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor(COLOR_SECONDARY)
    .text(invoice.buyer.name)
    .text(invoice.buyer.address)
    .text(`TIN: ${invoice.buyer.tin}`);

  if (invoice.buyer.vrn) {
    doc.text(`VRN: ${invoice.buyer.vrn}`);
  }

  doc.moveDown(1);
}

function renderLineItems(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  // Column definitions: [label, x-offset, width, align]
  const cols = [
    { label: 'Description', x: PAGE_MARGIN, w: 150, align: 'left' as const },
    { label: 'Qty', x: PAGE_MARGIN + 155, w: 40, align: 'right' as const },
    { label: 'Unit Price', x: PAGE_MARGIN + 200, w: 75, align: 'right' as const },
    { label: 'VAT Rate', x: PAGE_MARGIN + 280, w: 55, align: 'right' as const },
    { label: 'VAT Amt', x: PAGE_MARGIN + 340, w: 70, align: 'right' as const },
    { label: 'Total', x: PAGE_MARGIN + 415, w: 80, align: 'right' as const },
  ];

  // Header row
  const headerY = doc.y;
  doc
    .rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, 18)
    .fill(COLOR_HEADER_BG);

  doc.font(FONT_BOLD).fontSize(8).fillColor(COLOR_PRIMARY);
  for (const col of cols) {
    doc.text(col.label, col.x, headerY + 5, { width: col.w, align: col.align });
  }

  doc.y = headerY + 22;

  // Data rows
  doc.font(FONT_REGULAR).fontSize(8).fillColor(COLOR_SECONDARY);
  for (const item of invoice.items) {
    const rowY = doc.y;

    // Check if we need a new page
    if (rowY > 720) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
    }

    const currentY = doc.y;
    doc.text(item.description, cols[0].x, currentY, { width: cols[0].w, align: cols[0].align });
    doc.text(String(item.quantity), cols[1].x, currentY, { width: cols[1].w, align: cols[1].align });
    doc.text(formatCurrency(item.unitPrice), cols[2].x, currentY, { width: cols[2].w, align: cols[2].align });
    doc.text(`${(item.vatRate * 100).toFixed(1)}%`, cols[3].x, currentY, { width: cols[3].w, align: cols[3].align });
    doc.text(formatCurrency(item.vatAmount), cols[4].x, currentY, { width: cols[4].w, align: cols[4].align });
    doc.text(formatCurrency(item.lineTotal), cols[5].x, currentY, { width: cols[5].w, align: cols[5].align });

    doc.y = currentY + 14;

    // Light separator line
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(COLOR_LINE)
      .lineWidth(0.5)
      .stroke();

    doc.y += 4;
  }

  // Totals
  doc.moveDown(0.5);
  const totalsX = PAGE_MARGIN + 340;
  const totalsW = 155;

  doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_SECONDARY);
  renderTotalRow(doc, 'Subtotal:', formatCurrency(invoice.subtotal), totalsX, totalsW);
  renderTotalRow(doc, 'Total VAT:', formatCurrency(invoice.totalVat), totalsX, totalsW);

  doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_PRIMARY);
  renderTotalRow(doc, 'TOTAL:', formatCurrency(invoice.total), totalsX, totalsW);

  doc.moveDown(1);
}

function renderTotalRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  w: number,
): void {
  const y = doc.y;
  doc.text(label, x, y, { width: 70, align: 'left' });
  doc.text(value, x + 70, y, { width: w - 70, align: 'right' });
  doc.y = y + 14;
}

function renderVatBreakdown(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  if (invoice.vatBreakdown.length === 0) return;

  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(COLOR_PRIMARY)
    .text('VAT Breakdown', PAGE_MARGIN, doc.y);

  doc.moveDown(0.3);

  doc.font(FONT_REGULAR).fontSize(8).fillColor(COLOR_SECONDARY);
  for (const entry of invoice.vatBreakdown) {
    const rateLabel = entry.rateType === 'standard'
      ? `${(entry.rate * 100).toFixed(1)}% (Standard)`
      : entry.rateType === 'zero-rated'
        ? '0.0% (Zero-rated)'
        : '0.0% (Exempt)';

    doc.text(
      `${rateLabel}  —  Taxable: ${formatCurrency(entry.taxableAmount)}  |  VAT: ${formatCurrency(entry.vatAmount)}`,
      PAGE_MARGIN,
      doc.y + 1,
    );
  }

  doc.moveDown(1);
}

function renderPaymentInstructions(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(COLOR_PRIMARY)
    .text('Payment Instructions', PAGE_MARGIN, doc.y);

  doc.moveDown(0.3);
  doc
    .font(FONT_REGULAR)
    .fontSize(8)
    .fillColor(COLOR_SECONDARY)
    .text(`Please remit ${formatCurrency(invoice.total)} (${invoice.currency}) to ${invoice.seller.name}.`);

  if (invoice.dueDate) {
    doc.text(`Payment is due by ${formatDate(invoice.dueDate)}.`);
  }

  if (invoice.notes) {
    doc.moveDown(0.3);
    doc.font(FONT_REGULAR).fontSize(8).fillColor(COLOR_SECONDARY);
    doc.text(`Notes: ${invoice.notes}`);
  }

  doc.moveDown(1);
}

function renderFooter(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  // Separator line
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor(COLOR_LINE)
    .lineWidth(0.5)
    .stroke();

  doc.y += 8;

  doc
    .font(FONT_REGULAR)
    .fontSize(7)
    .fillColor(COLOR_SECONDARY)
    .text(
      'This invoice is issued in compliance with the Nigeria Tax Act (NTA) 2025 and VAT Act as amended. ' +
      'VAT is charged at the applicable rate per NTA 2025 Schedule 1 (zero-rated), Schedule 2 (exempt), ' +
      'or the standard rate of 7.5%. All amounts are in Nigerian Naira (NGN) unless otherwise stated.',
      PAGE_MARGIN,
      doc.y,
      { width: CONTENT_WIDTH },
    );

  doc.moveDown(0.5);
  doc.text(
    `Generated by ngtaxkit — Invoice ${invoice.invoiceNumber} | ${invoice.seller.tin}`,
    PAGE_MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, align: 'center' },
  );
}
