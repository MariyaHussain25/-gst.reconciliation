"""Tests for date_helpers — Phase 4"""

import pytest
from datetime import datetime
from app.utils.date_helpers import (
    parse_gst_date,
    format_date_to_iso,
    derive_period_from_date,
    to_period,
    derive_financial_year,
)


class TestParseGstDate:
    def test_d_mon_yy(self):
        """GSTR-2A Tally format: 15-Mar-23"""
        dt = parse_gst_date("15-Mar-23")
        assert dt.year == 2023
        assert dt.month == 3
        assert dt.day == 15

    def test_dd_mm_yyyy(self):
        """GSTR-2B format: 25/03/2023"""
        dt = parse_gst_date("25/03/2023")
        assert dt.year == 2023
        assert dt.month == 3
        assert dt.day == 25

    def test_iso(self):
        """ISO format: 2023-03-25"""
        dt = parse_gst_date("2023-03-25")
        assert dt.year == 2023
        assert dt.month == 3

    def test_dd_mm_yyyy_dashes(self):
        """DD-MM-YYYY: 25-03-2023"""
        dt = parse_gst_date("25-03-2023")
        assert dt.year == 2023
        assert dt.month == 3

    def test_dd_mm_yy_dashes(self):
        """DD-MM-YY: 15-03-23"""
        dt = parse_gst_date("15-03-23")
        assert dt.year == 2023
        assert dt.month == 3

    def test_dd_mm_yy_dots(self):
        """DD.MM.YY: 15.03.23"""
        dt = parse_gst_date("15.03.23")
        assert dt.year == 2023
        assert dt.month == 3

    def test_whitespace_handling(self):
        dt = parse_gst_date("  25/03/2023  ")
        assert dt.year == 2023

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_gst_date("not-a-date")

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            parse_gst_date("")

    def test_two_digit_year_2049(self):
        dt = parse_gst_date("15-03-49")
        assert dt.year == 2049

    def test_two_digit_year_1950(self):
        dt = parse_gst_date("15-03-50")
        assert dt.year == 1950


class TestFormatDateToIso:
    def test_gstr2a(self):
        assert format_date_to_iso("15-Mar-23") == "2023-03-15"

    def test_gstr2b(self):
        assert format_date_to_iso("25/03/2023") == "2023-03-25"


class TestDerivePeriodFromDate:
    def test_from_gstr2a(self):
        assert derive_period_from_date("15-Mar-23") == "2023-03"

    def test_from_gstr2b(self):
        assert derive_period_from_date("25/03/2023") == "2023-03"


class TestToPeriod:
    def test_basic(self):
        dt = datetime(2023, 3, 15)
        assert to_period(dt) == "2023-03"


class TestDeriveFinancialYear:
    def test_mar(self):
        assert derive_financial_year("2023-03") == "2022-23"

    def test_apr(self):
        assert derive_financial_year("2023-04") == "2023-24"

    def test_jan(self):
        assert derive_financial_year("2024-01") == "2023-24"

    def test_invalid(self):
        assert derive_financial_year("invalid") == ""
