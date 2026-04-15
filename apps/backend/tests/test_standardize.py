"""Tests for standardize_service — Phase 4"""

from app.services.standardize_service import (
    normalize_vendor_name,
    normalize_invoice_number,
    derive_period,
)


class TestNormalizeVendorName:
    def test_basic_uppercase(self):
        assert normalize_vendor_name("liberty glass creations") == "LIBERTY GLASS CREATIONS"

    def test_strips_ms_prefix(self):
        assert normalize_vendor_name("M/S. LIBERTY GLASS CREATIONS") == "LIBERTY GLASS CREATIONS"
        assert normalize_vendor_name("M/S LIBERTY GLASS") == "LIBERTY GLASS"

    def test_strips_messrs_prefix(self):
        assert normalize_vendor_name("MESSRS. NOBLE TRADERS") == "NOBLE TRADERS"

    def test_replaces_ampersand_with_and(self):
        result = normalize_vendor_name("SHARDA DOORS & PLYWOOD")
        assert "AND" in result
        assert "&" not in result

    def test_normalizes_legal_suffixes(self):
        assert normalize_vendor_name("ABC PRIVATE LIMITED").endswith("PVT LTD")
        assert normalize_vendor_name("XYZ LIMITED").endswith("LTD")
        assert normalize_vendor_name("DEF PVT. LTD.").endswith("PVT LTD")

    def test_removes_punctuation(self):
        result = normalize_vendor_name("A.B.C. COMPANY (P) LTD")
        assert "." not in result
        assert "(" not in result

    def test_collapses_spaces(self):
        result = normalize_vendor_name("RANJEET   GLASS   COMPANY")
        assert "  " not in result

    def test_empty_and_none(self):
        assert normalize_vendor_name("") == ""
        assert normalize_vendor_name(None) == ""

    def test_real_data_liberty(self):
        """Both variants from real data should normalize similarly"""
        a = normalize_vendor_name("LIBERTY GLASS CRETIONS")
        b = normalize_vendor_name("LIBERTY GLASS CREATIONS")
        # They won't be identical (typo), but both should be clean
        assert "LIBERTY" in a
        assert "LIBERTY" in b
        assert "&" not in a
        assert "&" not in b

    def test_real_data_sharda(self):
        """Test real data: SHARDA vs SHARDHA"""
        a = normalize_vendor_name("SHARDA DOORS & PLYWOOD")
        b = normalize_vendor_name("SHARDHA DOORS & PLYWOOD")
        assert "AND" in a
        assert "AND" in b


class TestNormalizeInvoiceNumber:
    def test_basic(self):
        assert normalize_invoice_number("544") == "544"

    def test_leading_zeros_numeric(self):
        """Purely numeric: strip leading zeros"""
        assert normalize_invoice_number("001") == "1"
        assert normalize_invoice_number("0544") == "544"

    def test_leading_zeros_alphanumeric(self):
        """Alphanumeric: keep leading zeros (don't strip from INV001)"""
        result = normalize_invoice_number("INV001")
        assert result == "INV001"

    def test_uppercase(self):
        assert normalize_invoice_number("inv-123") == "INV123"

    def test_special_chars_removed(self):
        result = normalize_invoice_number("INV/123#45")
        assert "/" not in result
        assert "#" not in result

    def test_all_zeros(self):
        assert normalize_invoice_number("000") == "0"

    def test_empty(self):
        assert normalize_invoice_number("") == ""


class TestDerivePeriod:
    def test_gstr2a_format(self):
        assert derive_period("15-Mar-23") == "2023-03"

    def test_gstr2b_format(self):
        assert derive_period("25/03/2023") == "2023-03"

    def test_iso_format(self):
        assert derive_period("2023-03-25") == "2023-03"

    def test_dd_mm_yyyy(self):
        assert derive_period("25-03-2023") == "2023-03"

    def test_empty(self):
        assert derive_period("") == ""
        assert derive_period(None) == ""
