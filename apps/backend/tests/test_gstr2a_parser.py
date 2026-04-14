from io import BytesIO

import openpyxl

from app.parsers.gstr2a_parser import parse_gstr2a


def _build_workbook_bytes(rows: list[list]):
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    output = BytesIO()
    wb.save(output)
    wb.close()
    return output.getvalue()


def test_parse_gstr2a_supports_tally_alias_headers_and_missing_invoice_amount():
    file_bytes = _build_workbook_bytes([
        [
            "Date", "Particulars", "GSTIN/UIN", "Vch Typ", "Vch No.",
            "Taxable Amount", "Integrated Tax Amount", "Central Tax Amount",
            "State Tax Amount", "Cess Amount", "Total Tax Amount",
        ],
        [
            "15-Mar-26", "Vendor A", "27ABCDE1234F1Z5", "Purchase", 101,
            1000, 100, 40, 40, 0, 180,
        ],
    ])

    result = parse_gstr2a(file_bytes, "tally.xlsx")

    assert len(result.invoices) == 1
    invoice = result.invoices[0]
    assert invoice.party_gstin == "27ABCDE1234F1Z5"
    assert invoice.vch_type == "Purchase"
    assert invoice.igst == 100
    assert invoice.cgst == 40
    assert invoice.sgst_utgst == 40
    assert invoice.cess == 0
    assert invoice.tax_amount == 180
    assert invoice.invoice_amount == 1180


def test_parse_gstr2a_uses_invoice_amount_when_column_present():
    file_bytes = _build_workbook_bytes([
        [
            "Date", "Particulars", "Party GSTIN/UIN", "Vch Type", "Vch No.",
            "Taxable Amount", "IGST", "CGST", "SGST/UTGST", "Cess",
            "Tax Amount", "Invoice Amount",
        ],
        [
            "15-Mar-26", "Vendor B", "27ABCDE1234F1Z5", "Purchase", 102,
            1000, 100, 40, 40, 0, 180, 1500,
        ],
    ])

    result = parse_gstr2a(file_bytes, "standard.xlsx")

    assert len(result.invoices) == 1
    assert result.invoices[0].invoice_amount == 1500
