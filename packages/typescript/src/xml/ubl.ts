// ─── UBL 3.0 BIS Billing XML Generation (Layer 2) ───────────────────────────
// Generates UBL 3.0 BIS Billing XML using template literals.
// Deterministic output: identical input → byte-level identical XML.
// Namespace: urn:oasis:names:specification:ubl:schema:xsd:Invoice-2

import type { Invoice, ComputedInvoiceItem, VatBreakdown } from '../invoice';

// ─── XML Helpers ─────────────────────────────────────────────────────────────

/** Escape XML special characters. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a number to 2 decimal places for XML output. */
function amount2(n: number): string {
  return n.toFixed(2);
}

/** Map invoice type to UBL InvoiceTypeCode. */
function invoiceTypeCode(type: string): string {
  switch (type) {
    case 'credit-note': return '381';
    case 'debit-note': return '383';
    default: return '380'; // commercial invoice
  }
}

// ─── Party XML ───────────────────────────────────────────────────────────────

function partyXml(tag: string, party: { name: string; tin: string; address: string; vrn?: string }): string {
  return `    <cac:${tag}>
      <cac:Party>
        <cac:PartyName>
          <cbc:Name>${escapeXml(party.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(party.address)}</cbc:StreetName>
          <cac:Country>
            <cbc:IdentificationCode>NG</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(party.tin)}</cbc:CompanyID>${party.vrn ? `\n          <cbc:TaxScheme>${escapeXml(party.vrn)}</cbc:TaxScheme>` : ''}
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>
          <cbc:CompanyID>${escapeXml(party.tin)}</cbc:CompanyID>
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:${tag}>`;
}

// ─── Tax Total XML ───────────────────────────────────────────────────────────

function taxSubtotalXml(entry: VatBreakdown, currency: string): string {
  const schemeId = entry.rateType === 'standard' ? 'S'
    : entry.rateType === 'zero-rated' ? 'Z'
    : 'E';
  return `      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${escapeXml(currency)}">${amount2(entry.taxableAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${escapeXml(currency)}">${amount2(entry.vatAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${schemeId}</cbc:ID>
          <cbc:Percent>${amount2(entry.rate * 100)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`;
}

// ─── Line Item XML ───────────────────────────────────────────────────────────

function lineItemXml(item: ComputedInvoiceItem, index: number, currency: string): string {
  const category = item.category ?? 'standard';
  const schemeId = item.vatRate > 0 ? 'S' : (category === 'standard' ? 'S' : isZeroRatedCategory(category) ? 'Z' : 'E');
  return `    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(currency)}">${amount2(item.lineNet)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${schemeId}</cbc:ID>
          <cbc:Percent>${amount2(item.vatRate * 100)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${escapeXml(currency)}">${amount2(item.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${escapeXml(currency)}">${amount2(item.vatAmount)}</cbc:TaxAmount>
      </cac:TaxTotal>
    </cac:InvoiceLine>`;
}

function isZeroRatedCategory(category: string): boolean {
  const zeroRated = [
    'basic-food', 'medicine', 'medical-equipment', 'medical-services',
    'educational-books', 'tuition', 'electricity', 'export-services', 'humanitarian-goods',
  ];
  return zeroRated.includes(category);
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate UBL 3.0 BIS Billing XML from an Invoice.
 * Deterministic: identical input produces byte-level identical output.
 */
export function toUBL(invoice: Invoice): string {
  const c = invoice.currency;

  const taxSubtotals = invoice.vatBreakdown
    .map((entry) => taxSubtotalXml(entry, c))
    .join('\n');

  const lines = invoice.items
    .map((item, i) => lineItemXml(item, i, c))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(invoice.issueDate)}</cbc:IssueDate>${invoice.dueDate ? `\n  <cbc:DueDate>${escapeXml(invoice.dueDate)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>${invoiceTypeCode(invoice.type)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(c)}</cbc:DocumentCurrencyCode>${invoice.purchaseOrderRef ? `\n  <cac:OrderReference>\n    <cbc:ID>${escapeXml(invoice.purchaseOrderRef)}</cbc:ID>\n  </cac:OrderReference>` : ''}${invoice.notes ? `\n  <cbc:Note>${escapeXml(invoice.notes)}</cbc:Note>` : ''}
${partyXml('AccountingSupplierParty', invoice.seller)}
${partyXml('AccountingCustomerParty', invoice.buyer)}
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${escapeXml(c)}">${amount2(invoice.totalVat)}</cbc:TaxAmount>
${taxSubtotals}
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
      <cbc:LineExtensionAmount currencyID="${escapeXml(c)}">${amount2(invoice.subtotal)}</cbc:LineExtensionAmount>
      <cbc:TaxExclusiveAmount currencyID="${escapeXml(c)}">${amount2(invoice.subtotal)}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="${escapeXml(c)}">${amount2(invoice.total)}</cbc:TaxInclusiveAmount>
      <cbc:PayableAmount currencyID="${escapeXml(c)}">${amount2(invoice.total)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${lines}
</Invoice>`;
}
