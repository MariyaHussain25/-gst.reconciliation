from io import BytesIO

import openpyxl

from app.parsers.gstr2b_parser import parse_gstr2b


def _build_workbook_bytes(rows: list[list]):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "B2B"
    for row in rows:
        ws.append(row)
    output = BytesIO()
    wb.save(output)
    wb.close()
    return output.getvalue()


def test_parse_gstr2b_dynamic_header_and_aliases():
    file_bytes = _build_workbook_bytes([
        ["Some title row"],
        [
            "Invoice Date", "Trade/Legal name", "GSTIN of supplier", "Invoice number",
            "Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax",
        ],
        ["15-03-2026", "Vendor A", "27ABCDE1234F1Z5", "0005/A", 1000, 100, 40, 40],
    ])

    result = parse_gstr2b(file_bytes, "2b.xlsx")

    assert len(result.b2b_invoices) == 1
    invoice = result.b2b_invoices[0]
    assert invoice.supplier_gstin == "27ABCDE1234F1Z5"
    assert invoice.invoice_number == "0005/A"
    assert invoice.taxable_value == 1000
    assert invoice.invoice_value == 1180


def test_parse_gstr2b_skips_rows_without_core_identifiers():
    file_bytes = _build_workbook_bytes([
        ["GSTIN of supplier", "Invoice number", "Invoice Date", "Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax"],
        ["", "INV001", "15-03-2026", 1000, 100, 40, 40],
        ["27ABCDE1234F1Z5", "", "15-03-2026", 1000, 100, 40, 40],
        ["27ABCDE1234F1Z5", "INV003", "15-03-2026", 1000, 100, 40, 40],
    ])

    result = parse_gstr2b(file_bytes, "2b-skip.xlsx")
    assert len(result.b2b_invoices) == 1
    assert result.b2b_invoices[0].invoice_number == "INV003"
