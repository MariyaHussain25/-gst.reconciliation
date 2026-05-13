"""
Standardization service — normalizes vendor names, invoice numbers, and derives periods.

Handles real-world GST data discrepancies between GSTR-2A and GSTR-2B:
  - "LIBERTY GLASS CRETIONS" (2A) vs "LIBERTY GLASS CREATIONS" (2B)
  - "SHARDA DOORS & PLYWOOD"  (2A) vs "SHARDHA DOORS AND PLYWOOD" (2B)
  - "PSI-25/26/02103"          (2B) vs "02103"                     (2A vch_no)
  - "INV/2024/001"             (2B) vs "INV2024001"                 (2A)
"""

import re
from app.models.invoice import Invoice
from app.utils.date_helpers import parse_gst_date, to_period


# ── Legal suffix normalizations ───────────────────────────────────────────────
LEGAL_SUFFIX_MAP = {
    "PRIVATE LIMITED": "PVT LTD",
    "PVT LIMITED":     "PVT LTD",
    "PRIVATE LTD":     "PVT LTD",
    "PVT. LTD.":       "PVT LTD",
    "PVT.LTD.":        "PVT LTD",
    "PVT. LIMITED":    "PVT LTD",
    "LIMITED":         "LTD",
    "LTD.":            "LTD",
    "CORPORATION":     "CORP",
    "ENTERPRISES":     "ENT",
}

# Prefixes to strip from vendor names
VENDOR_PREFIXES = [
    "M/S.", "M/S", "MESSRS.", "MESSRS",
    "MR.", "MR", "MS.", "MS",
    "SRI", "SHRI", "SMT",
]

# Characters to treat as word separators when normalizing invoice numbers
# We keep alphanumeric and then collapse separators so that:
#   "PSI-25/26/02103" → "PSI252602103"  (all separators removed)
#   "INV/2024/001"    → "INV2024001"
#   "02103"           → "2103"          (leading-zero strip)
_INV_SEPARATOR_RE = re.compile(r'[^A-Z0-9]+')
_LEADING_ZERO_RE  = re.compile(r'^0+(?=[A-Z])')   # strip leading zeros before a letter
_PURELY_NUMERIC   = re.compile(r'^\d+$')


def normalize_vendor_name(name: str) -> str:
    """
    Normalize vendor name for fuzzy matching.

    Steps
    -----
    1. Uppercase + strip whitespace.
    2. Remove common prefixes (M/S, MESSRS, SRI, etc.).
    3. Replace & / ' and ' with AND.
    4. Normalize legal suffixes (PRIVATE LIMITED → PVT LTD).
    5. Remove all punctuation except spaces.
    6. Collapse multiple spaces.

    The result is used only for matching (stored in normalized_vendor_name);
    the original vendor_name is preserved for display.
    """
    if not name:
        return ""

    result = name.upper().strip()

    # Strip prefixes
    for prefix in VENDOR_PREFIXES:
        if result.startswith(prefix + " "):
            result = result[len(prefix):].strip()
            break

    # Normalize & → AND, ' and ' → AND
    result = re.sub(r'\s+AND\s+', ' AND ', result.replace("&", " AND "))

    # Normalize legal suffixes (longest match first to avoid partial replacements)
    for long_form in sorted(LEGAL_SUFFIX_MAP, key=len, reverse=True):
        if result.endswith(" " + long_form) or result == long_form:
            result = result[: len(result) - len(long_form)].rstrip() + " " + LEGAL_SUFFIX_MAP[long_form]
            break

    # Remove all punctuation (keep only A-Z, 0-9, space)
    result = re.sub(r'[^A-Z0-9\s]', '', result)

    # Collapse spaces
    result = re.sub(r'\s+', ' ', result).strip()

    return result


def normalize_invoice_number(num: str) -> str:
    """
    Normalize invoice number for matching.

    Steps
    -----
    1. Strip + uppercase.
    2. Remove ALL separators (-, /, \\, ., spaces) — collapse to alphanumeric only.
       Rationale: "PSI-25/26/02103" and "PSI252602103" and "02103" should all
       produce a string that shares the critical numeric suffix "252602103".
       RapidFuzz token_set_ratio then handles the partial overlap.
    3. Strip leading zeros from purely numeric strings only:
         "002103" → "2103"
         "INV001" → "INV001"  (not stripped — has letters)
    4. Return "0" for an all-zero input (edge case).

    Note: the original invoice_number is preserved for display purposes.
    """
    if not num:
        return ""

    result = str(num).strip().upper()

    # Remove all non-alphanumeric characters (separators, slashes, dashes, etc.)
    result = _INV_SEPARATOR_RE.sub('', result)

    if not result:
        return ""

    # Strip leading zeros only for purely numeric invoice numbers
    if _PURELY_NUMERIC.match(result):
        stripped = result.lstrip('0')
        return stripped if stripped else '0'

    # For alphanumeric (e.g. "INV001"), strip only leading zeros before the
    # first alphabetic character (handles "00INV" → "INV" edge case)
    result = _LEADING_ZERO_RE.sub('', result)
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
    """
    Apply all normalizations to a list of Invoice documents in-place.

    Operations
    ----------
    - normalized_vendor_name    ← normalize_vendor_name(vendor_name)
    - normalized_invoice_number ← normalize_invoice_number(invoice_number)
    - period                    ← derived from invoice_date if not already set
    - total_amount              ← recomputed as sum of tax components (2 d.p.)
    """
    for invoice in invoices:
        invoice.normalized_vendor_name    = normalize_vendor_name(invoice.vendor_name)
        invoice.normalized_invoice_number = normalize_invoice_number(invoice.invoice_number)

        if not invoice.period:
            invoice.period = derive_period(str(invoice.invoice_date))

        # Recompute total_amount from components to fix any upstream rounding
        invoice.total_amount = round(
            (invoice.taxable_amount or 0.0)
            + (invoice.igst          or 0.0)
            + (invoice.cgst          or 0.0)
            + (invoice.sgst          or 0.0)
            + (invoice.cess          or 0.0),
            2,
        )

    return invoices