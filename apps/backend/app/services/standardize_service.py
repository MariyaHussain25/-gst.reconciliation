"""
Standardization service - rewrite of standardize.service.ts
Normalizes vendor names, invoice numbers, and derives periods.
"""

import re
from datetime import datetime
from app.models.invoice import Invoice


def normalize_vendor_name(name: str) -> str:
    """Uppercase, strip whitespace, remove special chars except &, collapse spaces."""
    if not name:
        return ""
    result = name.upper().strip()
    result = re.sub(r'[^A-Z0-9&\s]', '', result)
    result = re.sub(r'\s+', ' ', result)
    return result.strip()


def normalize_invoice_number(num: str) -> str:
    """Strip, remove leading zeros, remove special chars except hyphens, uppercase."""
    if not num:
        return ""
    result = num.strip().upper()
    result = re.sub(r'[^A-Z0-9\-]', '', result)
    result = result.lstrip('0')
    return result


def derive_period(date_str: str, date_format: str = None) -> str:
    """Parse date string and return YYYY-MM period string."""
    if not date_str:
        return ""
    formats = [date_format] if date_format else []
    formats += ["%d-%b-%y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d-%b-%Y"]
    for fmt in formats:
        if fmt is None:
            continue
        try:
            dt = datetime.strptime(str(date_str).strip(), fmt)
            return dt.strftime("%Y-%m")
        except (ValueError, TypeError):
            continue
    return ""


def batch_standardize(invoices: list[Invoice]) -> list[Invoice]:
    """Apply all normalizations to each invoice."""
    for invoice in invoices:
        invoice.normalized_vendor_name = normalize_vendor_name(invoice.vendor_name)
        invoice.normalized_invoice_number = normalize_invoice_number(invoice.invoice_number)
        if not invoice.period:
            invoice.period = derive_period(str(invoice.invoice_date))
    return invoices
