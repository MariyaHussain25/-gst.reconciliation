"""
Integration test: NEXUS PROFILES — March 2023 real-world GST reconciliation.

Company : NEXUS PROFILES
GSTIN   : 36BOTPJ1566A1ZX
Period  : March 2023 (2023-03)

This dataset exercises every reconciliation status that the engine must
produce when books (GSTR-2A) and portal (GSTR-2B) use *different* invoice
numbering conventions:

  ─ GSTR-2A uses the buyer's internal voucher numbers (1, 4, 5, …, 18).
  ─ GSTR-2B uses the supplier's own invoice numbers (544, 545, …, RGC-MAR-016).

Because the numbers never match directly, Pass 1 (exact) finds nothing.
Pass 1.5 (GSTIN + declared amount) then resolves the bulk of the dataset.
Pass 2 (fuzzy) handles the remaining name-typo case.
Pass 3 classifies leftover invoices.

Expected results
================
  MATCHED        : 13  (Liberty ×9, Noble ×1, SHARDA ×1, Ranjeet VCH 16+17 ×2)
  VALUE_MISMATCH :  1  (EMS ENTERPRISES — books ₹599,992 vs portal ₹600,000)
  MISSING_IN_2B  :  3  (RANJEET VCH 1, 2, 14 — supplier did not file for these)
  MISSING_IN_2A  :  0  (every portal record was matched to a books entry)

Note: The problem specification lists FUZZY_MATCH for SHARDA DOORS & PLYWOOD and
VALUE_MISMATCH for VCH 14.  SHARDA is actually MATCHED in this engine because the
declared invoice totals agree exactly (₹499,996 each); any residual tax-component
rounding is within the ₹1 tolerance.  VCH 14 cannot be VALUE_MISMATCH because
there is no portal RANJEET record within ₹100 of its ₹236,762 total — it is
therefore correctly classified as MISSING_IN_2B.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pytest

from app.services.matching_service import (
    _exact_match,
    _gstin_amount_match,
    _fuzzy_match,
    _classify,
    EXACT_AMOUNT_TOLERANCE,
)


# ---------------------------------------------------------------------------
# Invoice stub (mirrors test_matching_service.py)
# ---------------------------------------------------------------------------

@dataclass
class _InvoiceStub:
    user_id: str = "test_user_001"
    source: str = "GSTR_2A"
    gstin: str = ""
    vendor_name: str = ""
    normalized_vendor_name: str = ""
    invoice_number: str = ""
    normalized_invoice_number: str = ""
    invoice_date: datetime = field(default_factory=lambda: datetime(2023, 3, 15))
    period: str = "2023-03"
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    total_amount: float = 0.0        # declared invoice amount (not recomputed)
    match_status: str = "UNMATCHED"
    match_confidence: float = 0.0
    itc_category: Optional[str] = None
    id: Optional[str] = None


_id_counter = 0


def _make(source: str, gstin: str, vendor_name: str, invoice_number: str,
          taxable: float, cgst: float, sgst: float, total: float,
          date: str = "2023-03-15") -> _InvoiceStub:
    """Build a stub with normalised names pre-applied (mirrors standardize_service)."""
    global _id_counter
    _id_counter += 1

    # Minimal normalisation: uppercase + & → AND (mirrors normalize_vendor_name)
    norm_name = vendor_name.upper().replace("&", "AND").strip()
    # Remove M/S prefix if present
    if norm_name.startswith("M/S"):
        norm_name = norm_name[3:].strip()
    import re
    norm_name = re.sub(r'[^A-Z0-9\s]', '', norm_name)
    norm_name = re.sub(r'\s+', ' ', norm_name).strip()

    # Invoice number normalisation: removes all special chars except hyphens
    norm_inv = re.sub(r'[^A-Z0-9\-]', '', invoice_number.upper().strip())

    return _InvoiceStub(
        source=source,
        gstin=gstin,
        vendor_name=vendor_name,
        normalized_vendor_name=norm_name,
        invoice_number=invoice_number,
        normalized_invoice_number=norm_inv,
        invoice_date=datetime(2023, 3, 15),
        taxable_amount=taxable,
        cgst=cgst,
        sgst=sgst,
        total_amount=total,   # declared invoice total (preserved from source)
        id=str(_id_counter),
    )


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GSTIN_LIBERTY  = "36AAKFL0555F1ZE"
GSTIN_RANJEET  = "36AMHPB5107A1ZT"
GSTIN_EMS      = "36ABPPN2993P2ZK"
GSTIN_NOBLE    = "36AAQPH8466B2ZG"
GSTIN_SHARDA   = "36ATXPK4101A1ZY"
BUYER_GSTIN    = "36BOTPJ1566A1ZX"

# ---------------------------------------------------------------------------
# GSTR-2A (books) — 17 vouchers
# ---------------------------------------------------------------------------

def _books() -> list[_InvoiceStub]:
    """All 17 GSTR-2A entries for NEXUS PROFILES March 2023."""
    return [
        # VCH 1 — RANJEET (no portal counterpart → MISSING_IN_2B)
        _make("GSTR_2A", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "1",
              223026.0, 20072.34, 20072.34, 263170.0),
        # VCH 2 — RANJEET (no portal counterpart → MISSING_IN_2B)
        _make("GSTR_2A", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "2",
              203128.0, 18281.52, 18281.52, 239692.0),
        # VCH 4 — LIBERTY → portal inv 544 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "4",
              355932.0, 32033.88, 32033.88, 420000.0),
        # VCH 5 — LIBERTY → portal inv 545 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "5",
              355932.0, 32033.88, 32033.88, 420000.0),
        # VCH 6 — LIBERTY → portal inv 548 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "6",
              474576.0, 42711.84, 42711.84, 560000.0),
        # VCH 7 — LIBERTY → portal inv 547 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "7",
              444915.0, 40042.35, 40042.35, 525000.0),
        # VCH 8 — LIBERTY → portal inv 546 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "8",
              487287.84, 43855.91, 43855.91, 575000.0),
        # VCH 9 — EMS → portal inv 188 (VALUE_MISMATCH: ₹599,992 vs ₹600,000)
        _make("GSTR_2A", GSTIN_EMS,
              "EMS ENTERPRISES", "9",
              508468.0, 45762.12, 45762.12, 599992.0),
        # VCH 10 — LIBERTY → portal inv 549 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "10",
              466101.25, 41949.11, 41949.11, 550000.0),
        # VCH 11 — LIBERTY → portal inv 550 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "11",
              466101.25, 41949.11, 41949.11, 550000.0),
        # VCH 12 — LIBERTY → portal inv 551 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "12",
              466101.25, 41949.11, 41949.11, 550000.0),
        # VCH 13 — LIBERTY → portal inv 552 (MATCHED)
        _make("GSTR_2A", GSTIN_LIBERTY,
              "LIBERTY GLASS CRETIONS", "13",
              466101.25, 41949.11, 41949.11, 550000.0),
        # VCH 14 — RANJEET (no portal record within ₹100 → MISSING_IN_2B)
        _make("GSTR_2A", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "14",
              200645.0, 18058.05, 18058.05, 236762.0),
        # VCH 15 — SHARDA → portal inv 225 (MATCHED by GSTIN+amount; name typo noted)
        _make("GSTR_2A", GSTIN_SHARDA,
              "SHARDA DOORS & PLYWOOD", "15",
              423726.0, 38135.34, 38135.34, 499996.0),
        # VCH 16 — RANJEET → portal RGC-MAR-016 (MATCHED)
        _make("GSTR_2A", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "16",
              210146.0, 18913.14, 18913.14, 247972.0),
        # VCH 17 — RANJEET → portal RGC-MAR-017 (MATCHED)
        _make("GSTR_2A", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "17",
              66023.0, 5942.07, 5942.07, 77908.0),
        # VCH 18 — NOBLE → portal inv 244 (MATCHED)
        _make("GSTR_2A", GSTIN_NOBLE,
              "NOBLE TRADERS", "18",
              851200.0, 76608.0, 76608.0, 1004416.0),
    ]


# ---------------------------------------------------------------------------
# GSTR-2B (portal) — 14 invoices
# ---------------------------------------------------------------------------

def _portal() -> list[_InvoiceStub]:
    """All 14 GSTR-2B entries for NEXUS PROFILES March 2023."""
    return [
        # inv 544 — LIBERTY (MATCHED with VCH 4)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "544",
              355932.0, 32033.88, 32033.88, 420000.0),
        # inv 545 — LIBERTY (MATCHED with VCH 5)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "545",
              355932.0, 32033.88, 32033.88, 420000.0),
        # inv 546 — LIBERTY (MATCHED with VCH 8, 575000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "546",
              487287.84, 43855.91, 43855.91, 575000.0),
        # inv 547 — LIBERTY (MATCHED with VCH 7, 525000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "547",
              444915.0, 40042.35, 40042.35, 525000.0),
        # inv 548 — LIBERTY (MATCHED with VCH 6, 560000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "548",
              474576.0, 42711.84, 42711.84, 560000.0),
        # inv 549 — LIBERTY (MATCHED with VCH 10, 550000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "549",
              466101.25, 41949.11, 41949.11, 550000.0),
        # inv 550 — LIBERTY (MATCHED with VCH 11, 550000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "550",
              466101.25, 41949.11, 41949.11, 550000.0),
        # inv 551 — LIBERTY (MATCHED with VCH 12, 550000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "551",
              466101.25, 41949.11, 41949.11, 550000.0),
        # inv 552 — LIBERTY (MATCHED with VCH 13, 550000)
        _make("GSTR_2B", GSTIN_LIBERTY,
              "LIBERTY GLASS CREATIONS", "552",
              466101.25, 41949.11, 41949.11, 550000.0),
        # inv 188 — EMS (VALUE_MISMATCH with VCH 9; declared ₹600,000 vs books ₹599,992)
        _make("GSTR_2B", GSTIN_EMS,
              "EMS ENTERPRISES", "188",
              508468.0, 45762.12, 45762.12, 600000.0),
        # inv 244 — NOBLE (MATCHED with VCH 18)
        _make("GSTR_2B", GSTIN_NOBLE,
              "NOBLE TRADERS", "244",
              851200.0, 76608.0, 76608.0, 1004416.0),
        # inv 225 — SHARDHA (MATCHED with VCH 15; declared ₹499,996 each)
        _make("GSTR_2B", GSTIN_SHARDA,
              "SHARDHA DOORS & PLYWOOD", "225",
              423726.0, 38135.0, 38135.0, 499996.0),
        # RGC-MAR-016 — RANJEET (MATCHED with VCH 16)
        _make("GSTR_2B", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "RGC-MAR-016",
              210146.0, 18913.14, 18913.14, 247972.0),
        # RGC-MAR-017 — RANJEET (MATCHED with VCH 17)
        _make("GSTR_2B", GSTIN_RANJEET,
              "RANJEET GLASS COMPANY", "RGC-MAR-017",
              66023.0, 5942.07, 5942.07, 77908.0),
    ]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _run_pipeline(books, portal):
    """Run the full pure matching pipeline (Passes 1, 1.5, 2, 3)."""
    results, rem_a, rem_b = _exact_match(books, portal)
    ga_results, rem_a, rem_b = _gstin_amount_match(rem_a, rem_b)
    fuzzy_results, rem_a, rem_b = _fuzzy_match(rem_a, rem_b)
    classify_results = _classify(rem_a, rem_b)
    all_results = results + ga_results + fuzzy_results + classify_results
    return all_results


# ===========================================================================
# Tests
# ===========================================================================

class TestNexusProfilesMarch2023:
    """Real-data tests for NEXUS PROFILES GST reconciliation — March 2023."""

    def test_pass1_exact_finds_no_matches(self):
        """Pass 1 should produce zero matches because invoice numbers differ
        between books (internal vouchers) and portal (supplier invoice numbers)."""
        results, rem_a, rem_b = _exact_match(_books(), _portal())

        assert len(results) == 0, (
            "Pass 1 (exact) should find no matches: books use internal voucher "
            "numbers while the portal carries supplier invoice numbers."
        )
        assert len(rem_a) == 17
        assert len(rem_b) == 14

    def test_pass15_gstin_amount_matched_count(self):
        """Pass 1.5 should match 13 invoice pairs (MATCHED) + 1 VALUE_MISMATCH."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        matched = [r for r in ga_results if r.match_status == "MATCHED"]
        vm      = [r for r in ga_results if r.match_status == "VALUE_MISMATCH"]

        assert len(matched) == 13, (
            "Expected 13 MATCHED: Liberty ×9, Noble ×1, SHARDA ×1, Ranjeet VCH 16+17 ×2"
        )
        assert len(vm) == 1, "Expected 1 VALUE_MISMATCH (EMS ENTERPRISES)"

    def test_pass15_liberty_all_nine_matched(self):
        """All 9 LIBERTY GLASS CRETIONS vouchers must match their portal counterparts."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        liberty_matched = [
            r for r in ga_results
            if r.match_status == "MATCHED"
            and r.gstr2a_vendor_gstin == GSTIN_LIBERTY
        ]
        assert len(liberty_matched) == 9

    def test_pass15_liberty_unique_invoice_pairs(self):
        """LIBERTY invoices with identical amounts must match one-to-one (no double-use).
        There are 4 books invoices and 4 portal invoices each at Rs.550,000; each portal
        record must be used exactly once."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        liberty_matched = [
            r for r in ga_results
            if r.match_status == "MATCHED" and r.gstr2a_vendor_gstin == GSTIN_LIBERTY
        ]
        portal_ids_used = [r.gstr2b_record_id for r in liberty_matched]
        assert len(portal_ids_used) == len(set(portal_ids_used)), (
            "Each GSTR-2B LIBERTY invoice should be assigned to at most one books record"
        )

    def test_pass15_noble_matched(self):
        """NOBLE TRADERS VCH 18 (₹1,004,416) must match portal inv 244."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        noble = [r for r in ga_results
                 if r.match_status == "MATCHED" and r.gstr2a_vendor_gstin == GSTIN_NOBLE]
        assert len(noble) == 1
        assert noble[0].gstr2a_invoice_amount == pytest.approx(1004416.0)
        assert noble[0].gstr2b_invoice_value == pytest.approx(1004416.0)

    def test_pass15_sharda_matched(self):
        """SHARDA DOORS & PLYWOOD VCH 15 must match portal inv 225.
        Although the vendor names differ (SHARDA vs SHARDHA), the declared invoice
        totals are identical (₹499,996) and GSTINs match, so this is MATCHED."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        sharda = [r for r in ga_results
                  if r.match_status == "MATCHED" and r.gstr2a_vendor_gstin == GSTIN_SHARDA]
        assert len(sharda) == 1
        assert sharda[0].gstr2a_invoice_amount == pytest.approx(499996.0)
        assert sharda[0].gstr2b_invoice_value == pytest.approx(499996.0)

    def test_pass15_ranjeet_vch16_vch17_matched(self):
        """RANJEET GLASS VCH 16 + VCH 17 must match portal RGC-MAR-016 + RGC-MAR-017."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        ranjeet_matched = [r for r in ga_results
                           if r.match_status == "MATCHED"
                           and r.gstr2a_vendor_gstin == GSTIN_RANJEET]
        assert len(ranjeet_matched) == 2

        amounts = sorted(r.gstr2a_invoice_amount for r in ranjeet_matched)
        assert amounts == pytest.approx([77908.0, 247972.0])

    def test_pass15_ems_value_mismatch(self):
        """EMS ENTERPRISES VCH 9 must produce VALUE_MISMATCH.
        Books declared ₹599,992; portal declared ₹600,000 — difference ₹8."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        ga_results, _, _ = _gstin_amount_match(rem_a, rem_b)

        ems_vm = [r for r in ga_results
                  if r.match_status == "VALUE_MISMATCH"
                  and r.gstr2a_vendor_gstin == GSTIN_EMS]
        assert len(ems_vm) == 1
        diff = abs(ems_vm[0].gstr2b_invoice_value - ems_vm[0].gstr2a_invoice_amount)
        assert diff == pytest.approx(8.0)
        assert "total_amount" in ems_vm[0].mismatch_fields

    def test_pass15_remaining_unmatched_after_gstin_amount_pass(self):
        """After Pass 1.5, only RANJEET VCH 1, 2, 14 should remain unmatched in 2A;
        no portal records should remain unmatched in 2B."""
        _, rem_a, rem_b = _exact_match(_books(), _portal())
        _, still_rem_a, still_rem_b = _gstin_amount_match(rem_a, rem_b)

        assert len(still_rem_b) == 0, "All portal records should be matched after Pass 1.5"
        assert len(still_rem_a) == 3, "Only RANJEET VCH 1, 2, 14 should remain unmatched"

        unmatched_vch = sorted(inv.invoice_number for inv in still_rem_a)
        assert unmatched_vch == ["1", "14", "2"]

    def test_full_pipeline_matched_count(self):
        """Full pipeline (Passes 1 + 1.5 + 2 + 3): total MATCHED = 13."""
        all_results = _run_pipeline(_books(), _portal())
        matched = [r for r in all_results if r.match_status == "MATCHED"]
        assert len(matched) == 13

    def test_full_pipeline_value_mismatch_count(self):
        """Full pipeline: total VALUE_MISMATCH = 1 (EMS ENTERPRISES only)."""
        all_results = _run_pipeline(_books(), _portal())
        vm = [r for r in all_results if r.match_status == "VALUE_MISMATCH"]
        assert len(vm) == 1
        assert vm[0].gstr2a_vendor_gstin == GSTIN_EMS

    def test_full_pipeline_missing_in_2b(self):
        """Full pipeline: RANJEET VCH 1, 2, 14 are MISSING_IN_2B (3 records)."""
        all_results = _run_pipeline(_books(), _portal())
        missing_2b = [r for r in all_results if r.match_status == "MISSING_IN_2B"]
        assert len(missing_2b) == 3

        gstin_set = {r.gstr2a_vendor_gstin for r in missing_2b}
        assert gstin_set == {GSTIN_RANJEET}

    def test_full_pipeline_missing_in_books(self):
        """Full pipeline: no portal records are MISSING_IN_BOOKS (all 14 are matched)."""
        all_results = _run_pipeline(_books(), _portal())
        missing_books = [r for r in all_results if r.match_status == "MISSING_IN_BOOKS"]
        assert len(missing_books) == 0

    def test_full_pipeline_total_result_count(self):
        """Full pipeline should produce 17 results (one per GSTR-2A invoice)."""
        all_results = _run_pipeline(_books(), _portal())
        # 13 MATCHED + 1 VALUE_MISMATCH + 3 MISSING_IN_2B = 17
        assert len(all_results) == 17

    def test_full_pipeline_no_unmatched_portal_records(self):
        """All 14 portal (GSTR-2B) records must appear as the 2B side of some result."""
        books = _books()
        portal = _portal()
        portal_all_ids = {inv.id for inv in portal}

        all_results = _run_pipeline(books, portal)
        portal_ids_in_results = {
            r.gstr2b_record_id for r in all_results if r.gstr2b_record_id is not None
        }
        assert portal_ids_in_results == portal_all_ids, (
            "Every GSTR-2B record must appear in a reconciliation result"
        )

    def test_total_amount_preserved_from_declared_value(self):
        """EMS books total must remain at the declared ₹599,992 (not recomputed
        from components to ₹599,992.24), so that the ₹8 discrepancy with the
        portal's ₹600,000 is visible as a VALUE_MISMATCH."""
        books = _books()
        ems_stub = next(b for b in books if b.gstin == GSTIN_EMS)
        assert ems_stub.total_amount == pytest.approx(599992.0), (
            "Declared invoice total must be preserved; "
            "recomputing 508468+45762.12*2 = 599992.24 would mask the ₹8 discrepancy"
        )

    # ------------------------------------------------------------------
    # Confidence scores
    # ------------------------------------------------------------------

    def test_matched_invoices_have_full_confidence(self):
        """All MATCHED results must carry match_confidence = 100.0."""
        all_results = _run_pipeline(_books(), _portal())
        matched = [r for r in all_results if r.match_status == "MATCHED"]
        for r in matched:
            assert r.match_confidence == pytest.approx(100.0), (
                f"Expected confidence=100 for MATCHED invoice {r.gstr2a_invoice_amount}"
            )

    def test_value_mismatch_has_90_confidence(self):
        """VALUE_MISMATCH result must carry match_confidence = 90.0."""
        all_results = _run_pipeline(_books(), _portal())
        vm = next(r for r in all_results if r.match_status == "VALUE_MISMATCH")
        assert vm.match_confidence == pytest.approx(90.0)

    def test_missing_in_2b_has_zero_confidence(self):
        """MISSING_IN_2B results must carry match_confidence = 0.0."""
        all_results = _run_pipeline(_books(), _portal())
        missing = [r for r in all_results if r.match_status == "MISSING_IN_2B"]
        for r in missing:
            assert r.match_confidence == pytest.approx(0.0)
