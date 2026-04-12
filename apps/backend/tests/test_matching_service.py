"""Tests for matching_service — Phase 5 (pure helper functions)"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pytest

from app.services.matching_service import (
    _build_composite_string,
    _build_result,
    _check_exact_match,
    _compute_amount_diff,
    _exact_match,
    _fuzzy_match,
    _classify,
    EXACT_AMOUNT_TOLERANCE,
    FUZZY_AMOUNT_TOLERANCE,
    FUZZY_MATCH_THRESHOLD,
    NEEDS_REVIEW_THRESHOLD,
)


# ---------------------------------------------------------------------------
# Lightweight stub that mimics the Invoice fields used by pure helpers
# ---------------------------------------------------------------------------

@dataclass
class _InvoiceStub:
    """Minimal Invoice-like object for testing pure helper functions."""
    user_id: str = "user1"
    source: str = "GSTR_2A"
    gstin: str = "27AAAAA0000A1Z5"
    vendor_name: str = "TEST VENDOR"
    normalized_vendor_name: str = "TEST VENDOR"
    invoice_number: str = "INV001"
    normalized_invoice_number: str = "INV001"
    invoice_date: datetime = field(default_factory=lambda: datetime(2023, 3, 15))
    period: str = "2023-03"
    taxable_amount: float = 1000.0
    igst: float = 180.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    total_amount: float = 1180.0
    match_status: str = "UNMATCHED"
    match_confidence: float = 0.0
    itc_category: Optional[str] = None
    id: Optional[str] = None  # simulates MongoDB ObjectId


def _make_invoice(**kwargs) -> _InvoiceStub:
    return _InvoiceStub(**kwargs)


# ---------------------------------------------------------------------------
# _build_composite_string
# ---------------------------------------------------------------------------

class TestBuildCompositeString:
    def test_basic(self):
        inv = _make_invoice(normalized_vendor_name="LIBERTY GLASS", normalized_invoice_number="544")
        assert _build_composite_string(inv) == "LIBERTY GLASS 544"

    def test_empty_fields(self):
        inv = _make_invoice(normalized_vendor_name="", normalized_invoice_number="")
        assert _build_composite_string(inv) == " "

    def test_spaces_preserved(self):
        inv = _make_invoice(normalized_vendor_name="A B C", normalized_invoice_number="INV-001")
        result = _build_composite_string(inv)
        assert result == "A B C INV-001"


# ---------------------------------------------------------------------------
# _check_exact_match
# ---------------------------------------------------------------------------

class TestCheckExactMatch:
    def test_exact_match(self):
        a = _make_invoice(source="GSTR_2A", total_amount=1180.0)
        b = _make_invoice(source="GSTR_2B", total_amount=1180.0)
        assert _check_exact_match(a, b) is True

    def test_within_tolerance(self):
        a = _make_invoice(source="GSTR_2A", total_amount=1180.0)
        b = _make_invoice(source="GSTR_2B", total_amount=1180.99)
        assert _check_exact_match(a, b) is True

    def test_outside_tolerance(self):
        a = _make_invoice(source="GSTR_2A", total_amount=1180.0)
        b = _make_invoice(source="GSTR_2B", total_amount=1182.0)
        assert _check_exact_match(a, b) is False

    def test_gstin_mismatch(self):
        a = _make_invoice(source="GSTR_2A", gstin="27AAAAA0000A1Z5")
        b = _make_invoice(source="GSTR_2B", gstin="29BBBBB0000B1Z3")
        assert _check_exact_match(a, b) is False

    def test_invoice_number_mismatch(self):
        a = _make_invoice(source="GSTR_2A", normalized_invoice_number="INV001")
        b = _make_invoice(source="GSTR_2B", normalized_invoice_number="INV002")
        assert _check_exact_match(a, b) is False

    def test_gstin_case_insensitive(self):
        a = _make_invoice(source="GSTR_2A", gstin="27aaaaa0000a1z5")
        b = _make_invoice(source="GSTR_2B", gstin="27AAAAA0000A1Z5")
        assert _check_exact_match(a, b) is True

    def test_custom_tolerance(self):
        a = _make_invoice(source="GSTR_2A", total_amount=1180.0)
        b = _make_invoice(source="GSTR_2B", total_amount=1230.0)
        assert _check_exact_match(a, b, tolerance=50.0) is True
        assert _check_exact_match(a, b, tolerance=10.0) is False


# ---------------------------------------------------------------------------
# _compute_amount_diff
# ---------------------------------------------------------------------------

class TestComputeAmountDiff:
    def test_no_diff(self):
        a = _make_invoice(taxable_amount=1000.0, igst=180.0, cgst=0.0, sgst=0.0, total_amount=1180.0)
        b = _make_invoice(taxable_amount=1000.0, igst=180.0, cgst=0.0, sgst=0.0, total_amount=1180.0)
        result = _compute_amount_diff(a, b)
        assert result["taxable_amount_diff"] == 0.0
        assert result["igst_diff"] == 0.0
        assert result["total_amount_diff"] == 0.0

    def test_positive_diff(self):
        a = _make_invoice(taxable_amount=1100.0, igst=198.0, total_amount=1298.0)
        b = _make_invoice(taxable_amount=1000.0, igst=180.0, total_amount=1180.0)
        result = _compute_amount_diff(a, b)
        assert result["taxable_amount_diff"] == 100.0
        assert result["igst_diff"] == 18.0
        assert result["total_amount_diff"] == 118.0

    def test_rounding(self):
        a = _make_invoice(taxable_amount=1000.015, igst=0.0, total_amount=1000.015)
        b = _make_invoice(taxable_amount=1000.0, igst=0.0, total_amount=1000.0)
        result = _compute_amount_diff(a, b)
        # 1000.015 - 1000.0 = 0.015, rounded to 2 decimals = 0.01 or 0.02
        assert result["taxable_amount_diff"] == round(1000.015 - 1000.0, 2)


# ---------------------------------------------------------------------------
# _exact_match (logic integration without DB)
# ---------------------------------------------------------------------------

class TestExactMatch:
    def test_basic_exact_match(self):
        a = _make_invoice(source="GSTR_2A", id="id_a1")
        b = _make_invoice(source="GSTR_2B", id="id_b1")
        results, rem_a, rem_b = _exact_match([a], [b])
        assert len(results) == 1
        assert results[0].match_status == "MATCHED"
        assert results[0].match_confidence == 100.0
        assert len(rem_a) == 0
        assert len(rem_b) == 0

    def test_value_mismatch(self):
        a = _make_invoice(source="GSTR_2A", total_amount=1180.0, id="id_a2")
        b = _make_invoice(source="GSTR_2B", total_amount=1200.0, id="id_b2")
        results, rem_a, rem_b = _exact_match([a], [b])
        assert len(results) == 1
        assert results[0].match_status == "VALUE_MISMATCH"
        assert results[0].match_confidence == 90.0
        assert len(rem_a) == 0
        assert len(rem_b) == 0

    def test_no_match_different_gstin(self):
        a = _make_invoice(source="GSTR_2A", gstin="27AAAAA0000A1Z5", id="id_a3")
        b = _make_invoice(source="GSTR_2B", gstin="29BBBBB0000B1Z3", id="id_b3")
        results, rem_a, rem_b = _exact_match([a], [b])
        assert len(results) == 0
        assert len(rem_a) == 1
        assert len(rem_b) == 1

    def test_empty_lists(self):
        results, rem_a, rem_b = _exact_match([], [])
        assert results == []
        assert rem_a == []
        assert rem_b == []

    def test_multiple_invoices_partial_match(self):
        a1 = _make_invoice(source="GSTR_2A", invoice_number="INV001", normalized_invoice_number="INV001", id="a1")
        a2 = _make_invoice(source="GSTR_2A", invoice_number="INV999", normalized_invoice_number="INV999", id="a2")
        b1 = _make_invoice(source="GSTR_2B", invoice_number="INV001", normalized_invoice_number="INV001", id="b1")
        results, rem_a, rem_b = _exact_match([a1, a2], [b1])
        assert len(results) == 1
        assert results[0].match_status == "MATCHED"
        assert len(rem_a) == 1  # a2 unmatched
        assert len(rem_b) == 0

    def test_mismatch_fields_populated(self):
        a = _make_invoice(source="GSTR_2A", taxable_amount=900.0, total_amount=1080.0, id="id_a5")
        b = _make_invoice(source="GSTR_2B", taxable_amount=1000.0, total_amount=1200.0, id="id_b5")
        results, _, _ = _exact_match([a], [b])
        assert results[0].match_status == "VALUE_MISMATCH"
        assert "total_amount" in results[0].mismatch_fields


# ---------------------------------------------------------------------------
# _fuzzy_match
# ---------------------------------------------------------------------------

class TestFuzzyMatch:
    def test_fuzzy_match_similar_vendor(self):
        """Slightly different vendor name — should fuzzy match."""
        a = _make_invoice(
            source="GSTR_2A",
            normalized_vendor_name="LIBERTY GLASS CRETIONS",
            normalized_invoice_number="544",
            total_amount=1180.0,
            id="fa1",
        )
        b = _make_invoice(
            source="GSTR_2B",
            normalized_vendor_name="LIBERTY GLASS CREATIONS",
            normalized_invoice_number="544",
            total_amount=1180.0,
            id="fb1",
        )
        results, rem_a, rem_b = _fuzzy_match([a], [b])
        assert len(results) == 1
        assert results[0].match_status in ("FUZZY_MATCHED", "NEEDS_REVIEW")
        assert len(rem_a) == 0

    def test_gstin_mismatch_detected(self):
        """Same invoice number + amount but different GSTIN → GSTIN_MISMATCH."""
        a = _make_invoice(
            source="GSTR_2A",
            gstin="27AAAAA0000A1Z5",
            normalized_invoice_number="INV001",
            total_amount=1180.0,
            id="gm_a",
        )
        b = _make_invoice(
            source="GSTR_2B",
            gstin="29BBBBB0000B1Z3",
            normalized_invoice_number="INV001",
            total_amount=1180.0,
            id="gm_b",
        )
        results, rem_a, rem_b = _fuzzy_match([a], [b])
        assert len(results) == 1
        assert results[0].match_status == "GSTIN_MISMATCH"
        assert results[0].match_confidence == 75.0

    def test_amount_too_different_no_fuzzy(self):
        """Amount diff > ₹100 should prevent fuzzy matching."""
        a = _make_invoice(
            source="GSTR_2A",
            normalized_vendor_name="SHARDA DOORS AND PLYWOOD",
            normalized_invoice_number="INV001",
            total_amount=1000.0,
            id="fa3",
        )
        b = _make_invoice(
            source="GSTR_2B",
            normalized_vendor_name="SHARDA DOORS AND PLYWOOD",
            normalized_invoice_number="INV001",
            total_amount=1200.0,  # diff = 200 > 100
            id="fb3",
        )
        results, rem_a, rem_b = _fuzzy_match([a], [b])
        assert len(results) == 0
        assert len(rem_a) == 1
        assert len(rem_b) == 1

    def test_empty_lists(self):
        results, rem_a, rem_b = _fuzzy_match([], [])
        assert results == []
        assert rem_a == []
        assert rem_b == []


# ---------------------------------------------------------------------------
# _classify
# ---------------------------------------------------------------------------

class TestClassify:
    def test_missing_in_2b(self):
        a = _make_invoice(source="GSTR_2A", id="cl_a1")
        results = _classify([a], [])
        assert len(results) == 1
        assert results[0].match_status == "MISSING_IN_2B"
        assert a.match_status == "MISSING_IN_2B"

    def test_missing_in_books(self):
        b = _make_invoice(source="GSTR_2B", id="cl_b1")
        results = _classify([], [b])
        assert len(results) == 1
        assert results[0].match_status == "MISSING_IN_BOOKS"
        assert b.match_status == "MISSING_IN_BOOKS"

    def test_both_sides(self):
        a = _make_invoice(source="GSTR_2A", id="cl_a2")
        b = _make_invoice(source="GSTR_2B", id="cl_b2")
        results = _classify([a], [b])
        assert len(results) == 2
        statuses = {r.match_status for r in results}
        assert statuses == {"MISSING_IN_2B", "MISSING_IN_BOOKS"}

    def test_empty_lists(self):
        results = _classify([], [])
        assert results == []


class TestBuildResult:
    def test_itc_availability_yes_for_eligible(self):
        a = _make_invoice(source="GSTR_2A", id="br_a")
        b = _make_invoice(source="GSTR_2B", id="br_b", itc_category="ELIGIBLE", igst=18.0, cgst=0.0, sgst=0.0)
        result = _build_result(a, b, "MATCHED", 100.0)
        assert result.itc_availability == "Yes"
        assert result.itc_claimable_amount == 18.0

    def test_itc_availability_no_for_non_claimable_category(self):
        a = _make_invoice(source="GSTR_2A", id="br_a2")
        b = _make_invoice(source="GSTR_2B", id="br_b2", itc_category="BLOCKED", igst=18.0, cgst=0.0, sgst=0.0)
        result = _build_result(a, b, "MATCHED", 100.0)
        assert result.itc_availability == "No"
        assert result.itc_blocked_amount == 18.0

    def test_itc_availability_and_amount_yes_for_claimable_category(self):
        a = _make_invoice(source="GSTR_2A", id="br_a3")
        b = _make_invoice(source="GSTR_2B", id="br_b3", itc_category="CLAIMABLE", igst=18.0, cgst=0.0, sgst=0.0)
        result = _build_result(a, b, "MATCHED", 100.0)
        assert result.itc_availability == "Yes"
        assert result.itc_claimable_amount == 18.0
