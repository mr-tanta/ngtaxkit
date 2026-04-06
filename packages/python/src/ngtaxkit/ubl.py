"""UBL 3.0 BIS Billing XML generation (Layer 2).

Deterministic: identical input produces byte-level identical XML output.
"""

from __future__ import annotations

from typing import Any


_ZERO_RATED = frozenset([
    "basic-food", "medicine", "medical-equipment", "medical-services",
    "educational-books", "tuition", "electricity", "export-services", "humanitarian-goods",
])


def _escape_xml(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


def _amount2(n: float) -> str:
    return f"{n:.2f}"


def _invoice_type_code(t: str) -> str:
    if t == "credit-note":
        return "381"
    if t == "debit-note":
        return "383"
    return "380"


def _party_xml(tag: str, party: dict[str, Any]) -> str:
    vrn_line = ""
    if party.get("vrn"):
        vrn_line = f"\n          <cbc:TaxScheme>{_escape_xml(party['vrn'])}</cbc:TaxScheme>"
    return f"""    <cac:{tag}>
      <cac:Party>
        <cac:PartyName>
          <cbc:Name>{_escape_xml(party['name'])}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>{_escape_xml(party['address'])}</cbc:StreetName>
          <cac:Country>
            <cbc:IdentificationCode>NG</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        <cac:PartyTaxScheme>
          <cbc:CompanyID>{_escape_xml(party['tin'])}</cbc:CompanyID>{vrn_line}
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>{_escape_xml(party['name'])}</cbc:RegistrationName>
          <cbc:CompanyID>{_escape_xml(party['tin'])}</cbc:CompanyID>
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:{tag}>"""


def _tax_subtotal_xml(entry: dict[str, Any], currency: str) -> str:
    rt = entry["rate_type"]
    scheme_id = "S" if rt == "standard" else ("Z" if rt == "zero-rated" else "E")
    c = _escape_xml(currency)
    return f"""      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="{c}">{_amount2(entry['taxable_amount'])}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="{c}">{_amount2(entry['vat_amount'])}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>{scheme_id}</cbc:ID>
          <cbc:Percent>{_amount2(entry['rate'] * 100)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>"""


def _line_item_xml(item: dict[str, Any], index: int, currency: str) -> str:
    category = item.get("category", "standard")
    if item["vat_rate"] > 0:
        scheme_id = "S"
    elif category in _ZERO_RATED:
        scheme_id = "Z"
    else:
        scheme_id = "E"
    c = _escape_xml(currency)
    return f"""    <cac:InvoiceLine>
      <cbc:ID>{index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">{item['quantity']}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="{c}">{_amount2(item['line_net'])}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>{_escape_xml(item['description'])}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>{scheme_id}</cbc:ID>
          <cbc:Percent>{_amount2(item['vat_rate'] * 100)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="{c}">{_amount2(item['unit_price'])}</cbc:PriceAmount>
      </cac:Price>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="{c}">{_amount2(item['vat_amount'])}</cbc:TaxAmount>
      </cac:TaxTotal>
    </cac:InvoiceLine>"""


def to_ubl(inv: dict[str, Any]) -> str:
    """Generate UBL 3.0 BIS Billing XML from an invoice dict."""
    c = inv["currency"]
    ec = _escape_xml(c)

    tax_subtotals = "\n".join(
        _tax_subtotal_xml(e, c) for e in inv["vat_breakdown"]
    )
    lines = "\n".join(
        _line_item_xml(item, i, c) for i, item in enumerate(inv["items"])
    )

    due_date_line = ""
    if inv.get("due_date"):
        due_date_line = f"\n  <cbc:DueDate>{_escape_xml(inv['due_date'])}</cbc:DueDate>"

    po_ref_block = ""
    if inv.get("purchase_order_ref"):
        po_ref_block = f"\n  <cac:OrderReference>\n    <cbc:ID>{_escape_xml(inv['purchase_order_ref'])}</cbc:ID>\n  </cac:OrderReference>"

    notes_line = ""
    if inv.get("notes"):
        notes_line = f"\n  <cbc:Note>{_escape_xml(inv['notes'])}</cbc:Note>"

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>{_escape_xml(inv['invoice_number'])}</cbc:ID>
  <cbc:IssueDate>{_escape_xml(inv['issue_date'])}</cbc:IssueDate>{due_date_line}
  <cbc:InvoiceTypeCode>{_invoice_type_code(inv['type'])}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{ec}</cbc:DocumentCurrencyCode>{po_ref_block}{notes_line}
{_party_xml('AccountingSupplierParty', inv['seller'])}
{_party_xml('AccountingCustomerParty', inv['buyer'])}
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="{ec}">{_amount2(inv['total_vat'])}</cbc:TaxAmount>
{tax_subtotals}
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
      <cbc:LineExtensionAmount currencyID="{ec}">{_amount2(inv['subtotal'])}</cbc:LineExtensionAmount>
      <cbc:TaxExclusiveAmount currencyID="{ec}">{_amount2(inv['subtotal'])}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="{ec}">{_amount2(inv['total'])}</cbc:TaxInclusiveAmount>
      <cbc:PayableAmount currencyID="{ec}">{_amount2(inv['total'])}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
{lines}
</Invoice>"""
