"""
GSTR-2B Excel parser using openpyxl.
Rewrite of gstr2b.parser.ts with identical logic.
"""

from io import BytesIO
from typing import Dict, List, Optional
import openpyxl
from pydantic import BaseModel


class Gstr2BMetadata(BaseModel):
    financial_year: str = ""
    tax_period: str = ""
    buyer_gstin: str = ""
    legal_name: str = ""
    trade_name: str = ""
    date_of_generation: str = ""


class Gstr2BInvoice(BaseModel):
    sheet_name: str = ""
    supplier_gstin: str = ""
    supplier_trade_name: str = ""
    invoice_number: str = ""
    invoice_type: str = ""
    invoice_date: str = ""
    invoice_value: float = 0.0
    place_of_supply: str = ""
    supply_attracts_reverse_charge: str = ""
    tax_rate: Optional[float] = None
    taxable_value: float = 0.0
    integrated_tax: float = 0.0
    central_tax: float = 0.0
    state_ut_tax: float = 0.0
    cess: float = 0.0
    gstr1_period: Optional[str] = None
    gstr1_filing_date: Optional[str] = None
    itc_availability: str = ""
    itc_unavailable_reason: Optional[str] = None
    applicable_tax_rate_percent: Optional[float] = None
    source: str = ""
    irn: Optional[str] = None
    irn_date: Optional[str] = None


class ItcSummary(BaseModel):
    part_a: dict = {}
    part_b: dict = {}


class Gstr2BParseResult(BaseModel):
    metadata: Gstr2BMetadata
    b2b_invoices: List[Gstr2BInvoice]
    itc_available_summary: ItcSummary
    itc_not_available_summary: ItcSummary


B2B_REQUIRED_COLUMNS = [
    'GSTIN of supplier', 'Trade/Legal name', 'Invoice number', 'Invoice type',
    'Invoice date', 'Invoice Value(₹)', 'Place of supply',
    'Supply Attracts Reverse Charge', 'Rate(%)', 'Taxable value',
    'Integrated Tax', 'Central Tax', 'State/UT tax', 'Cess',
    'GSTR-1/IFF/GSTR-5 Period', 'GSTR-1/IFF/GSTR-5 Filing Date',
    'ITC Availability', 'Reason', 'Applicable % of Tax Rate',
    'Source', 'IRN', 'IRN date'
]


def safe_number(val) -> float:
    if val is None or val == "":
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def safe_optional_number(val) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_str(val) -> str:
    if val is None:
        return ""
    return str(val).strip()


def safe_optional_str(val) -> Optional[str]:
    if val is None or safe_str(val) == "":
        return None
    return str(val).strip()


def _extract_readme_metadata(ws) -> Gstr2BMetadata:
    """Extract metadata from 'Read me' sheet."""
    metadata = Gstr2BMetadata()
    for row in ws.iter_rows(values_only=True):
        if not row or row[0] is None:
            continue
        key = safe_str(row[0]).lower()
        value = safe_str(row[1]) if len(row) > 1 and row[1] is not None else ""
        if "financial year" in key:
            metadata.financial_year = value
        elif "tax period" in key:
            metadata.tax_period = value
        elif "gstin" in key:
            metadata.buyer_gstin = value
        elif "legal name" in key:
            metadata.legal_name = value
        elif "trade name" in key:
            metadata.trade_name = value
        elif "date of generation" in key:
            metadata.date_of_generation = value
    return metadata


def _parse_b2b_sheet(ws) -> List[Gstr2BInvoice]:
    """Parse the B2B sheet into invoice records."""
    all_rows = list(ws.iter_rows(values_only=True))
    header_row_idx = -1
    col_map: Dict[str, int] = {}

    # Find header row by looking for "GSTIN of supplier" in any cell
    for i, row in enumerate(all_rows):
        if not row:
            continue
        for j, cell in enumerate(row):
            if cell is not None and "GSTIN of supplier" in safe_str(cell):
                header_row_idx = i
                for k, h in enumerate(row):
                    if h is not None:
                        col_map[safe_str(h).strip()] = k
                break
        if header_row_idx != -1:
            break

    if header_row_idx == -1:
        return []

    invoices: List[Gstr2BInvoice] = []
    for row in all_rows[header_row_idx + 1:]:
        if not row:
            continue
        supplier_gstin = safe_str(row[col_map.get('GSTIN of supplier', -1)] if col_map.get('GSTIN of supplier', -1) >= 0 and col_map.get('GSTIN of supplier', -1) < len(row) else None)
        if not supplier_gstin:
            continue

        def get_cell(col_name: str):
            idx = col_map.get(col_name, -1)
            if idx < 0 or idx >= len(row):
                return None
            return row[idx]

        invoice = Gstr2BInvoice(
            sheet_name="B2B",
            supplier_gstin=supplier_gstin,
            supplier_trade_name=safe_str(get_cell('Trade/Legal name')),
            invoice_number=safe_str(get_cell('Invoice number')),
            invoice_type=safe_str(get_cell('Invoice type')),
            invoice_date=safe_str(get_cell('Invoice date')),
            invoice_value=safe_number(get_cell('Invoice Value(₹)')),
            place_of_supply=safe_str(get_cell('Place of supply')),
            supply_attracts_reverse_charge=safe_str(get_cell('Supply Attracts Reverse Charge')),
            tax_rate=safe_optional_number(get_cell('Rate(%)')),
            taxable_value=safe_number(get_cell('Taxable value')),
            integrated_tax=safe_number(get_cell('Integrated Tax')),
            central_tax=safe_number(get_cell('Central Tax')),
            state_ut_tax=safe_number(get_cell('State/UT tax')),
            cess=safe_number(get_cell('Cess')),
            gstr1_period=safe_optional_str(get_cell('GSTR-1/IFF/GSTR-5 Period')),
            gstr1_filing_date=safe_optional_str(get_cell('GSTR-1/IFF/GSTR-5 Filing Date')),
            itc_availability=safe_str(get_cell('ITC Availability')),
            itc_unavailable_reason=safe_optional_str(get_cell('Reason')),
            applicable_tax_rate_percent=safe_optional_number(get_cell('Applicable % of Tax Rate')),
            source=safe_str(get_cell('Source')),
            irn=safe_optional_str(get_cell('IRN')),
            irn_date=safe_optional_str(get_cell('IRN date')),
        )
        invoices.append(invoice)

    return invoices


def _parse_itc_summary_sheet(ws) -> ItcSummary:
    """Parse ITC summary sheet into ItcSummary."""
    part_a: dict = {}
    part_b: dict = {}
    current_part = None
    for row in ws.iter_rows(values_only=True):
        if not row or row[0] is None:
            continue
        cell = safe_str(row[0]).lower()
        if "part a" in cell:
            current_part = "a"
        elif "part b" in cell:
            current_part = "b"
        elif current_part and row[0] is not None:
            key = safe_str(row[0])
            value = safe_number(row[1]) if len(row) > 1 else 0.0
            if current_part == "a":
                part_a[key] = value
            else:
                part_b[key] = value
    return ItcSummary(part_a=part_a, part_b=part_b)


def parse_gstr2b(file_bytes: bytes, file_name: str) -> Gstr2BParseResult:
    """Parse GSTR-2B Excel file and return structured data."""
    wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)

    # Extract metadata from "Read me" sheet
    metadata = Gstr2BMetadata()
    for sheet_name in wb.sheetnames:
        if sheet_name.lower().strip() == "read me":
            metadata = _extract_readme_metadata(wb[sheet_name])
            break

    # Parse B2B invoices
    b2b_invoices: List[Gstr2BInvoice] = []
    for sheet_name in wb.sheetnames:
        if sheet_name.strip().upper() == "B2B":
            b2b_invoices = _parse_b2b_sheet(wb[sheet_name])
            break

    # Parse ITC summary sheets
    itc_available_summary = ItcSummary()
    itc_not_available_summary = ItcSummary()
    for sheet_name in wb.sheetnames:
        name_lower = sheet_name.lower().strip()
        if "itc available" in name_lower and "not" not in name_lower:
            itc_available_summary = _parse_itc_summary_sheet(wb[sheet_name])
        elif "itc not available" in name_lower:
            itc_not_available_summary = _parse_itc_summary_sheet(wb[sheet_name])

    wb.close()
    return Gstr2BParseResult(
        metadata=metadata,
        b2b_invoices=b2b_invoices,
        itc_available_summary=itc_available_summary,
        itc_not_available_summary=itc_not_available_summary,
    )
