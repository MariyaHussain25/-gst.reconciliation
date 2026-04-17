"""
GSTR-2A Excel parser using openpyxl.
Rewrite of gstr2a.parser.ts with identical logic.
"""

import re
from io import BytesIO
from typing import Optional
import openpyxl
from pydantic import BaseModel


class Gstr2AMetadata(BaseModel):
    company_name: str = ""
    period_start: str = ""
    period_end: str = ""
    gstin: str = ""


class Gstr2AInvoice(BaseModel):
    date: str = ""
    particulars: str = ""
    party_gstin: str = ""
    vch_type: str = ""
    vch_no: str = ""
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst_utgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0
    invoice_amount: float = 0.0


class Gstr2AParseResult(BaseModel):
    metadata: Gstr2AMetadata
    invoices: list[Gstr2AInvoice]


def safe_number(val) -> float:
    """Returns 0 for None/empty/non-numeric values."""
    if val is None or val == "":
        return 0.0
    try:
        if isinstance(val, str):
            cleaned = val.replace("₹", "").replace(",", "").strip()
            return float(cleaned) if cleaned else 0.0
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def safe_str(val) -> str:
    """Returns empty string for None values."""
    if val is None:
        return ""
    return str(val).strip()


CORE_COLUMNS = ("party_gstin", "invoice_number", "invoice_date", "taxable_amount")

GST_HEADER_KEYWORDS = ("gstin", "tax", "invoice", "amount", "date", "particulars", "vch")

COLUMN_ALIASES: dict[str, list[str]] = {
    "party_gstin": ["Party GSTIN/UIN", "GSTIN/UIN", "GSTIN of supplier"],
    "vch_type": ["Vch Type", "Vch Typ", "Voucher Type"],
    "invoice_number": ["Vch No.", "Invoice No.", "Invoice Number", "Invoice number"],
    "invoice_date": ["Date", "Invoice Date", "Invoice date"],
    "particulars": ["Particulars", "Vendor Name", "Supplier Name"],
    "taxable_amount": ["Taxable Amount", "Taxable Value", "Taxable Income", "Taxable"],
    "igst": ["IGST", "Integrated Tax", "Integrated Tax Amount"],
    "cgst": ["CGST", "Central Tax", "Central Tax Amount"],
    "sgst": ["SGST/UTGST", "SGST", "State Tax", "State/UT Tax", "State Tax Amount"],
    "cess": ["Cess", "Cess Amount"],
    "tax_amount": ["Tax Amount", "Total Tax", "Total Tax Amount"],
    "invoice_amount": ["Invoice Amount", "Invoice Value", "Invoice Value(₹)"],
}


def _normalize_header(value) -> str:
    text = safe_str(value).replace("\n", " ").replace("\r", " ")
    # Remove symbols, spaces and punctuation for robust matching.
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _detect_header_row(all_rows: list[tuple]) -> int:
    best_idx = -1
    best_score = -1
    for i, row in enumerate(all_rows[:15]):
        if not row:
            continue
        score = 0
        for cell in row:
            normalized = _normalize_header(cell)
            if not normalized:
                continue
            if any(keyword in normalized for keyword in GST_HEADER_KEYWORDS):
                score += 1
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx if best_score > 0 else -1


def _build_column_map(header_row: tuple) -> dict[str, int]:
    alias_lookup: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_lookup[_normalize_header(alias)] = canonical

    resolved: dict[str, int] = {}
    for idx, cell in enumerate(header_row):
        normalized = _normalize_header(cell)
        if not normalized:
            continue
        canonical = alias_lookup.get(normalized)
        if canonical and canonical not in resolved:
            resolved[canonical] = idx
    return resolved


def _merge_split_header(all_rows: list[tuple], header_row_idx: int) -> tuple:
    """
    Some Tally exports split long column headers across two rows, e.g.:
      Row N:   [..., 'Invoice', 'Invoice', 'Taxable',  ...]
      Row N+1: [..., 'No.',     'Date',    'Amount',   ...]
    Merge them into one row when the following row contains only short
    label-like strings (no numbers or date objects).
    """
    header_row = all_rows[header_row_idx]
    if header_row_idx + 1 >= len(all_rows):
        return header_row

    next_row = all_rows[header_row_idx + 1]
    continuation_cells = 0
    for cell in next_row:
        if cell is None or cell == "":
            continue
        # If any cell is a non-string (number, date) it is a data row, not a header continuation
        if not isinstance(cell, str):
            return header_row
        if len(cell.strip()) > 25:
            return header_row
        continuation_cells += 1

    if continuation_cells == 0:
        return header_row

    merged = []
    for i, cell in enumerate(header_row):
        next_cell = next_row[i] if i < len(next_row) else None
        if next_cell and isinstance(next_cell, str) and next_cell.strip():
            merged.append((safe_str(cell) + " " + next_cell.strip()).strip())
        else:
            merged.append(cell)
    return tuple(merged)


def parse_gstr2a(file_bytes: bytes, file_name: str) -> Gstr2AParseResult:
    """Parse GSTR-2A Excel file and return structured data."""
    wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    try:
        ws = wb.worksheets[0]

        # Read all rows into a list
        all_rows = list(ws.iter_rows(values_only=True))

        metadata = Gstr2AMetadata()
        for row in all_rows[:15]:
            if not row:
                continue
            left = safe_str(row[0]).lower() if len(row) > 0 else ""
            right = safe_str(row[1]) if len(row) > 1 else ""
            if left.startswith("company") and right:
                metadata.company_name = right
            elif left.startswith("period") and right:
                period_str = right
                if " to " in period_str:
                    parts = period_str.split(" to ", 1)
                    metadata.period_start = parts[0].strip()
                    metadata.period_end = parts[1].strip()
            elif left.startswith("gst registration") and right:
                metadata.gstin = right
            # Tally Voucher Register format: company name is the first non-empty
            # standalone cell (no label prefix) and period is "D-Mon-YY to D-Mon-YY"
            elif not metadata.company_name and row[1] is None and left and not left.startswith("voucher"):
                metadata.company_name = safe_str(row[0])
            elif not metadata.period_start and " to " in left:
                parts = left.split(" to ", 1)
                metadata.period_start = parts[0].strip()
                metadata.period_end = parts[1].strip()

        header_row_idx = _detect_header_row(all_rows)

        if header_row_idx == -1:
            raise ValueError(f"Could not find header row in GSTR-2A file: {file_name}")

        # Merge split two-row headers (e.g. Tally Voucher Register export)
        merged_header = _merge_split_header(all_rows, header_row_idx)
        resolved_col_map = _build_column_map(merged_header)
        # Data rows start after the (possibly two-row) header
        has_split_header = merged_header != all_rows[header_row_idx]
        data_start_idx = header_row_idx + (2 if has_split_header else 1)

        missing_core = [column for column in CORE_COLUMNS if column not in resolved_col_map]
        if missing_core:
            raise ValueError(
                f"Missing required core columns in GSTR-2A file: {missing_core}. "
                "Expected at least GSTIN, Invoice No/Date and Taxable Amount."
            )

        invoices: list[Gstr2AInvoice] = []

        # Parse data rows after header
        for row in all_rows[data_start_idx:]:
            if not row or all(cell is None for cell in row):
                continue

            def get_cell(column: str):
                idx = resolved_col_map.get(column)
                if idx is None or idx >= len(row):
                    return None
                return row[idx]

            particulars = safe_str(get_cell("particulars"))
            if "total" in particulars.lower():
                continue

            date_val = get_cell("invoice_date")
            if date_val is None or safe_str(date_val) == "":
                continue

            party_gstin = safe_str(get_cell("party_gstin")).upper().replace(" ", "")
            invoice_number = safe_str(get_cell("invoice_number"))
            if not party_gstin or not invoice_number:
                # Skip incomplete/inapplicable rows gracefully.
                continue

            taxable_amount = safe_number(get_cell("taxable_amount"))
            tax_amount = safe_number(get_cell("tax_amount"))
            if tax_amount == 0.0:
                tax_amount = round(
                    safe_number(get_cell("igst"))
                    + safe_number(get_cell("cgst"))
                    + safe_number(get_cell("sgst"))
                    + safe_number(get_cell("cess")),
                    2,
                )
            invoice_amount_cell = get_cell("invoice_amount")
            if invoice_amount_cell is not None:
                invoice_amount = safe_number(invoice_amount_cell)
            else:
                invoice_amount = taxable_amount + tax_amount

            invoice = Gstr2AInvoice(
                date=safe_str(date_val),
                particulars=particulars,
                party_gstin=party_gstin,
                vch_type=safe_str(get_cell("vch_type")),
                vch_no=invoice_number,
                taxable_amount=taxable_amount,
                igst=safe_number(get_cell("igst")),
                cgst=safe_number(get_cell("cgst")),
                sgst_utgst=safe_number(get_cell("sgst")),
                cess=safe_number(get_cell("cess")),
                tax_amount=tax_amount,
                invoice_amount=invoice_amount,
            )
            invoices.append(invoice)

        return Gstr2AParseResult(metadata=metadata, invoices=invoices)
    finally:
        wb.close()
