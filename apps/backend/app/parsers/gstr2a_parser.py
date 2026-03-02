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
    'Tax Amount', 'Invoice Amount'
]


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
                    col_map[safe_str(cell).strip()] = j
            break

    if header_row_idx == -1:
        raise ValueError(f"Could not find header row in GSTR-2A file: {file_name}")

    # Validate required columns
    missing = [col for col in REQUIRED_COLUMNS if col not in col_map]
    if missing:
        raise ValueError(f"Missing required columns in GSTR-2A file: {missing}")

    invoices: list[Gstr2AInvoice] = []

    # Parse data rows after header
    for row in all_rows[header_row_idx + 1:]:
        if not row or all(cell is None for cell in row):
            continue

        particulars = safe_str(row[col_map['Particulars']])
        if "total" in particulars.lower():
            continue

        date_val = row[col_map['Date']]
        if date_val is None or safe_str(date_val) == "":
            continue

        invoice = Gstr2AInvoice(
            date=safe_str(date_val),
            particulars=particulars,
            party_gstin=safe_str(row[col_map['Party GSTIN/UIN']]),
            vch_type=safe_str(row[col_map['Vch Type']]),
            vch_no=safe_int(row[col_map['Vch No.']]),
            taxable_amount=safe_number(row[col_map['Taxable Amount']]),
            igst=safe_number(row[col_map['IGST']]),
            cgst=safe_number(row[col_map['CGST']]),
            sgst_utgst=safe_number(row[col_map['SGST/UTGST']]),
            cess=safe_number(row[col_map['Cess']]),
            tax_amount=safe_number(row[col_map['Tax Amount']]),
            invoice_amount=safe_number(row[col_map['Invoice Amount']]),
        )
        invoices.append(invoice)

    wb.close()
    return Gstr2AParseResult(metadata=metadata, invoices=invoices)
