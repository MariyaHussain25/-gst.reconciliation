"""
Standardization service — Phase 4 Complete Implementation
Normalizes vendor names, invoice numbers, and derives periods.
Handles real-world GST data discrepancies like:
  - "LIBERTY GLASS CRETIONS" (2A) vs "LIBERTY GLASS CREATIONS" (2B)
  - "SHARDA DOORS & PLYWOOD" (2A) vs "SHARDHA DOORS & PLYWOOD" (2B)
"""

import re
from app.models.invoice import Invoice
from app.utils.date_helpers import parse_gst_date, to_period


# Legal suffix normalizations
LEGAL_SUFFIX_MAP = {
    "PRIVATE LIMITED": "PVT LTD",
    "PVT LIMITED": "PVT LTD",
    "PRIVATE LTD": "PVT LTD",
    "PVT. LTD.": "PVT LTD",
    "PVT.LTD.": "PVT LTD",
    "PVT. LIMITED": "PVT LTD",
    "LIMITED": "LTD",
    "LTD.": "LTD",
}

# Prefixes to strip
VENDOR_PREFIXES = [
    "M/S.", "M/S", "MESSRS.", "MESSRS", "MR.", "MR", "MS.", "MS",
    "SRI", "SHRI", "SMT",
]


def normalize_vendor_name(name: str) -> str:
    """
    Normalize vendor name for matching:
    1. Uppercase + strip
    2. Remove M/S, MESSRS etc. prefixes
    3. Replace & with AND
    4. Normalize legal suffixes (PRIVATE LIMITED → PVT LTD)
    5. Remove punctuation (except spaces)
    6. Collapse multiple spaces
    """
    if not name:
        return ""

    result = name.upper().strip()

    # Strip vendor prefixes
    for prefix in VENDOR_PREFIXES:
        if result.startswith(prefix + " "):
            result = result[len(prefix):].strip()
            break

    # Replace & with AND
    result = result.replace("&", " AND ")

    # Normalize legal suffixes
    for long_form, short_form in LEGAL_SUFFIX_MAP.items():
        if result.endswith(long_form):
            result = result[:-len(long_form)] + short_form
            break

    # Remove all punctuation except spaces and alphanumeric
    result = re.sub(r'[^A-Z0-9\s]', '', result)

    # Collapse multiple spaces
    result = re.sub(r'\s+', ' ', result).strip()

    return result


def normalize_invoice_number(num: str) -> str:
    """
    Normalize invoice number:
    1. Strip + uppercase
    2. Remove special chars except hyphens
    3. Strip leading zeros ONLY for purely numeric values
       '001' → '1', but 'INV001' stays 'INV001'
    """
    if not num:
        return ""

    result = str(num).strip().upper()

    # Remove special chars except hyphens and alphanumeric
    result = re.sub(r'[^A-Z0-9\-]', '', result)

    # Only strip leading zeros if the entire string is purely numeric (no hyphens)
    if result.isdigit():
        stripped = result.lstrip('0')
        # All zeros — keep at least one digit
        return stripped if stripped else '0'

    return result


def derive_period(date_str: str) -> str:
    """Parse any GST date format and return YYYY-MM period string."""
    if not date_str:
        return ""
    try:
        dt = parse_gst_date(str(date_str).strip())
        return to_period(dt)
    except (ValueError, TypeError):
        return ""


def batch_standardize(invoices: list[Invoice]) -> list[Invoice]:
    """Apply all normalizations to a list of Invoice documents.

    The declared ``total_amount`` (set from the source's ``invoiceAmount`` /
    ``invoiceValue`` field by the ingest layer) is preserved as-is because it
    reflects what the supplier and buyer have actually declared on the invoice.
    Recomputing from individual tax components can mask real discrepancies —
    for example when the supplier's portal shows ₹600,000 but the buyer's
    books recorded ₹599,992. Those differences must surface as VALUE_MISMATCH
    in reconciliation, not be silently zeroed out.

    A computed fallback is still applied when ``total_amount`` is zero or
    missing (e.g. records that arrived without an explicit invoice total).
    """
    for invoice in invoices:
        invoice.normalized_vendor_name = normalize_vendor_name(invoice.vendor_name)
        invoice.normalized_invoice_number = normalize_invoice_number(invoice.invoice_number)
        if not invoice.period:
            invoice.period = derive_period(str(invoice.invoice_date))
        # Only compute total from components when the declared amount is absent or zero.
        # A zero-value invoice is treated as "not set" since GST invoices always carry
        # a positive value; if a genuine zero-total invoice ever appears it is safe to
        # leave total_amount at 0.0 (the computed value would also be 0.0).
        if invoice.total_amount is None or invoice.total_amount == 0.0:
            invoice.total_amount = round(
                invoice.taxable_amount + invoice.igst + invoice.cgst + invoice.sgst + invoice.cess,
                2,
            )
    return invoices
