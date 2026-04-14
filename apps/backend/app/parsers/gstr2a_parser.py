"""
GSTR-2A Excel parser using openpyxl.
Rewrite of gstr2a.parser.ts with identical logic.
"""

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
    vch_no: int = 0
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
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def safe_str(val) -> str:
    """Returns empty string for None values."""
    if val is None:
        return ""
    return str(val).strip()


def safe_int(val) -> int:
    """Returns 0 for None/empty/non-numeric values."""
    if val is None or val == "":
        return 0
    try:
        return int(float(str(val)))
    except (ValueError, TypeError):
        return 0


REQUIRED_COLUMNS = [
    'Date', 'Particulars', 'Party GSTIN/UIN', 'Vch Type', 'Vch No.',
    'Taxable Amount', 'IGST', 'CGST', 'SGST/UTGST', 'Cess',
    'Tax Amount'
]

COLUMN_ALIASES: dict[str, list[str]] = {
    'Party GSTIN/UIN': ['GSTIN/UIN'],
    'Vch Type': ['Vch Typ'],
    'IGST': ['Integrated Tax Amount'],
    'CGST': ['Central Tax Amount'],
    'SGST/UTGST': ['State Tax Amount'],
    'Cess': ['Cess Amount'],
    'Tax Amount': ['Total Tax Amount'],
}


def _normalize_header(value) -> str:
    return safe_str(value).lower()


def _resolve_column_index(col_map: dict[str, int], column: str) -> Optional[int]:
    for alias in [column, *COLUMN_ALIASES.get(column, [])]:
        idx = col_map.get(_normalize_header(alias))
        if idx is not None:
            return idx
    return None


def parse_gstr2a(file_bytes: bytes, file_name: str) -> Gstr2AParseResult:
    """Parse GSTR-2A Excel file and return structured data."""
    wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.worksheets[0]

    # Read all rows into a list
    all_rows = list(ws.iter_rows(values_only=True))

    metadata = Gstr2AMetadata()
    header_row_idx = -1
    col_map: dict[str, int] = {}

    # Extract metadata from header rows and find the column header row
    for i, row in enumerate(all_rows):
        if not row or row[0] is None:
            continue
        first_cell = safe_str(row[0]).lower()
        if first_cell.startswith("company"):
            metadata.company_name = safe_str(row[1]) if len(row) > 1 else ""
        elif first_cell.startswith("period"):
            period_str = safe_str(row[1]) if len(row) > 1 else ""
            if " to " in period_str:
                parts = period_str.split(" to ")
                metadata.period_start = parts[0].strip()
                metadata.period_end = parts[1].strip()
        elif first_cell.startswith("gst registration"):
            metadata.gstin = safe_str(row[1]) if len(row) > 1 else ""
        elif first_cell == "date":
            # This is the header row
            header_row_idx = i
            for j, cell in enumerate(row):
                if cell is not None:
                    col_map[_normalize_header(cell)] = j
            break

    if header_row_idx == -1:
        raise ValueError(f"Could not find header row in GSTR-2A file: {file_name}")

    # Resolve canonical column names using aliases and validate required columns
    resolved_col_map: dict[str, int] = {}
    missing = []
    for column in REQUIRED_COLUMNS:
        idx = _resolve_column_index(col_map, column)
        if idx is None:
            missing.append(column)
        else:
            resolved_col_map[column] = idx

    # Invoice Amount is optional
    invoice_amount_idx = _resolve_column_index(col_map, 'Invoice Amount')
    if invoice_amount_idx is not None:
        resolved_col_map['Invoice Amount'] = invoice_amount_idx

    if missing:
        raise ValueError(f"Missing required columns in GSTR-2A file: {missing}")

    invoices: list[Gstr2AInvoice] = []

    # Parse data rows after header
    for row in all_rows[header_row_idx + 1:]:
        if not row or all(cell is None for cell in row):
            continue

        def get_cell(column: str):
            idx = resolved_col_map.get(column)
            if idx is None or idx >= len(row):
                return None
            return row[idx]

        particulars = safe_str(get_cell('Particulars'))
        if "total" in particulars.lower():
            continue

        date_val = get_cell('Date')
        if date_val is None or safe_str(date_val) == "":
            continue

        taxable_amount = safe_number(get_cell('Taxable Amount'))
        tax_amount = safe_number(get_cell('Tax Amount'))
        invoice_amount_cell = get_cell('Invoice Amount')
        if invoice_amount_cell is not None:
            invoice_amount = safe_number(invoice_amount_cell)
        else:
            invoice_amount = taxable_amount + tax_amount

        invoice = Gstr2AInvoice(
            date=safe_str(date_val),
            particulars=particulars,
            party_gstin=safe_str(get_cell('Party GSTIN/UIN')),
            vch_type=safe_str(get_cell('Vch Type')),
            vch_no=safe_int(get_cell('Vch No.')),
            taxable_amount=taxable_amount,
            igst=safe_number(get_cell('IGST')),
            cgst=safe_number(get_cell('CGST')),
            sgst_utgst=safe_number(get_cell('SGST/UTGST')),
            cess=safe_number(get_cell('Cess')),
            tax_amount=tax_amount,
            invoice_amount=invoice_amount,
        )
        invoices.append(invoice)

    wb.close()
    return Gstr2AParseResult(metadata=metadata, invoices=invoices)
