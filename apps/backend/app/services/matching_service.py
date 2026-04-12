"""
3-Pass Matching Engine — Phase 5 Full Implementation (RapidFuzz)

Pass 1: Exact match  (GSTIN + normalized invoice number + amounts within ₹1)
Pass 2: Fuzzy match  (RapidFuzz token_set_ratio on composite vendor+invoice string)
Pass 3: Classification (MISSING_IN_2B / MISSING_IN_BOOKS)
"""

import logging
import uuid
from datetime import datetime

from rapidfuzz import fuzz

from app.models.invoice import Invoice
from app.models.reconciliation import Reconciliation, ReconciliationResult, ReconciliationSummary
from app.utils.date_helpers import derive_financial_year

logger = logging.getLogger(__name__)

# Matching thresholds
EXACT_AMOUNT_TOLERANCE = 1.0        # ₹1 tolerance for exact match
FUZZY_AMOUNT_TOLERANCE = 100.0      # ₹100 tolerance for fuzzy match
FUZZY_MATCH_THRESHOLD = 85          # RapidFuzz score for fuzzy match
NEEDS_REVIEW_THRESHOLD = 70         # RapidFuzz score for needs review


# ---------------------------------------------------------------------------
# Pure helper functions (testable without MongoDB)
# ---------------------------------------------------------------------------

def _build_composite_string(inv: Invoice) -> str:
    """Build the composite string used for fuzzy matching."""
    return f"{inv.normalized_vendor_name} {inv.normalized_invoice_number}"


def _check_exact_match(inv_2a: Invoice, inv_2b: Invoice, tolerance: float = EXACT_AMOUNT_TOLERANCE) -> bool:
    """Return True if the two invoices qualify as an exact match."""
    return (
        inv_2a.gstin.upper().strip() == inv_2b.gstin.upper().strip()
        and inv_2a.normalized_invoice_number == inv_2b.normalized_invoice_number
        and abs(inv_2a.total_amount - inv_2b.total_amount) <= tolerance
    )


def _compute_amount_diff(inv_a: Invoice, inv_b: Invoice) -> dict:
    """Return a dict of rounded amount differences (a − b)."""
    return {
        "taxable_amount_diff": round(inv_a.taxable_amount - inv_b.taxable_amount, 2),
        "igst_diff": round(inv_a.igst - inv_b.igst, 2),
        "cgst_diff": round(inv_a.cgst - inv_b.cgst, 2),
        "sgst_diff": round(inv_a.sgst - inv_b.sgst, 2),
        "total_amount_diff": round(inv_a.total_amount - inv_b.total_amount, 2),
    }


def _build_result(inv_2a: Invoice, inv_2b: Invoice, status: str, confidence: float,
                  mismatch_fields: list[str] | None = None,
                  mismatch_reason: str | None = None) -> ReconciliationResult:
    """Construct a ReconciliationResult from a matched pair."""
    diffs = _compute_amount_diff(inv_2a, inv_2b)
    # ITC claimable = total tax from 2B when ITC is eligible; blocked otherwise
    _inv_for_itc = inv_2b
    _total_tax = round(
        (_inv_for_itc.igst or 0.0) + (_inv_for_itc.cgst or 0.0) + (_inv_for_itc.sgst or 0.0), 2
    )
    _itc_category = inv_2b.itc_category or "ELIGIBLE"
    _itc_category_normalized = _itc_category.strip().upper()
    _itc_availability = "Yes" if _itc_category_normalized in {"ELIGIBLE", "CLAIMABLE"} else "No"
    _itc_claimable = _total_tax if _itc_category_normalized == "ELIGIBLE" else 0.0
    _itc_blocked = _total_tax if _itc_category_normalized == "BLOCKED" else 0.0
    return ReconciliationResult(
        gstr2a_record_id=str(inv_2a.id) if inv_2a.id else None,
        gstr2a_vendor_name=inv_2a.vendor_name,
        gstr2a_vendor_gstin=inv_2a.gstin,
        gstr2a_invoice_amount=inv_2a.total_amount,
        gstr2a_taxable_amount=inv_2a.taxable_amount,
        gstr2a_igst=inv_2a.igst,
        gstr2a_cgst=inv_2a.cgst,
        gstr2a_sgst=inv_2a.sgst,
        gstr2b_record_id=str(inv_2b.id) if inv_2b.id else None,
        gstr2b_vendor_name=inv_2b.vendor_name,
        gstr2b_vendor_gstin=inv_2b.gstin,
        gstr2b_invoice_number=inv_2b.invoice_number,
        gstr2b_invoice_value=inv_2b.total_amount,
        gstr2b_taxable_value=inv_2b.taxable_amount,
        gstr2b_igst=inv_2b.igst,
        gstr2b_cgst=inv_2b.cgst,
        gstr2b_sgst=inv_2b.sgst,
        gstr2b_itc_availability=inv_2b.itc_category,
        match_status=status,
        match_confidence=confidence,
        mismatch_fields=mismatch_fields or [],
        mismatch_reason=mismatch_reason,
        itc_availability=_itc_availability,
        itc_category=_itc_category,
        itc_claimable_amount=_itc_claimable,
        itc_blocked_amount=_itc_blocked,
        **diffs,
    )


# ---------------------------------------------------------------------------
# Pass 1: Exact match
# ---------------------------------------------------------------------------

async def run_exact_match_pass(user_id: str, period: str) -> list[dict]:
    """Pass 1: Exact matching — GSTIN + normalized invoice number + amount within ₹1.

    Returns a list of ReconciliationResult dicts and mutates both pools (via
    the returned unmatched sets) in-place through the orchestrator.  When called
    standalone the full invoice pool is re-fetched.
    """
    invoices_2a = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2A",
    ).to_list()

    invoices_2b = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2B",
    ).to_list()

    results, _, _ = _exact_match(invoices_2a, invoices_2b)
    return [r.model_dump() for r in results]


def _exact_match(
    invoices_2a: list[Invoice],
    invoices_2b: list[Invoice],
) -> tuple[list[ReconciliationResult], list[Invoice], list[Invoice]]:
    """Core exact-match logic (pure, testable).

    Returns (results, remaining_2a, remaining_2b).
    """
    results: list[ReconciliationResult] = []
    matched_2b_ids: set = set()
    remaining_2a: list[Invoice] = []

    # Build a lookup for GSTR-2B by (gstin_upper, normalized_invoice_number)
    b_by_key: dict[tuple, list[Invoice]] = {}
    for inv in invoices_2b:
        key = (inv.gstin.upper().strip(), inv.normalized_invoice_number)
        b_by_key.setdefault(key, []).append(inv)

    for inv_2a in invoices_2a:
        key = (inv_2a.gstin.upper().strip(), inv_2a.normalized_invoice_number)
        candidates = b_by_key.get(key, [])

        matched = False
        for inv_2b in candidates:
            if str(inv_2b.id) in matched_2b_ids:
                continue

            amount_diff = abs(inv_2a.total_amount - inv_2b.total_amount)

            if amount_diff <= EXACT_AMOUNT_TOLERANCE:
                # Exact match
                inv_2a.match_status = "MATCHED"
                inv_2a.match_confidence = 100.0
                inv_2b.match_status = "MATCHED"
                inv_2b.match_confidence = 100.0
                matched_2b_ids.add(str(inv_2b.id))
                results.append(_build_result(inv_2a, inv_2b, "MATCHED", 100.0))
                matched = True
                break

            # VALUE_MISMATCH: same GSTIN + invoice number but amount diff > ₹1
            mismatch_fields = []
            if amount_diff > EXACT_AMOUNT_TOLERANCE:
                mismatch_fields.append("total_amount")
            diffs = _compute_amount_diff(inv_2a, inv_2b)
            if diffs["taxable_amount_diff"] != 0:
                mismatch_fields.append("taxable_amount")
            if diffs["igst_diff"] != 0:
                mismatch_fields.append("igst")
            if diffs["cgst_diff"] != 0:
                mismatch_fields.append("cgst")
            if diffs["sgst_diff"] != 0:
                mismatch_fields.append("sgst")

            inv_2a.match_status = "VALUE_MISMATCH"
            inv_2a.match_confidence = 90.0
            inv_2b.match_status = "VALUE_MISMATCH"
            inv_2b.match_confidence = 90.0
            matched_2b_ids.add(str(inv_2b.id))
            results.append(_build_result(
                inv_2a, inv_2b, "VALUE_MISMATCH", 90.0,
                mismatch_fields=mismatch_fields,
                mismatch_reason=f"Amount difference: ₹{amount_diff:.2f}",
            ))
            matched = True
            break

        if not matched:
            remaining_2a.append(inv_2a)

    remaining_2b = [inv for inv in invoices_2b if str(inv.id) not in matched_2b_ids]
    return results, remaining_2a, remaining_2b


# ---------------------------------------------------------------------------
# Pass 2: Fuzzy match (RapidFuzz)
# ---------------------------------------------------------------------------

async def run_fuzzy_match_pass(user_id: str, period: str) -> list[dict]:
    """Pass 2: Fuzzy matching with RapidFuzz — called standalone."""
    invoices_2a = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2A",
        Invoice.match_status == "UNMATCHED",
    ).to_list()

    invoices_2b = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2B",
        Invoice.match_status == "UNMATCHED",
    ).to_list()

    results, _, _ = _fuzzy_match(invoices_2a, invoices_2b)
    return [r.model_dump() for r in results]


def _fuzzy_match(
    unmatched_2a: list[Invoice],
    unmatched_2b: list[Invoice],
) -> tuple[list[ReconciliationResult], list[Invoice], list[Invoice]]:
    """Core fuzzy-match logic (pure, testable).

    Returns (results, still_unmatched_2a, still_unmatched_2b).
    """
    results: list[ReconciliationResult] = []
    matched_2b_ids: set = set()
    remaining_2a: list[Invoice] = []

    for inv_2a in unmatched_2a:
        composite_a = _build_composite_string(inv_2a)
        best_score = 0.0
        best_inv_2b: Invoice | None = None

        for inv_2b in unmatched_2b:
            if str(inv_2b.id) in matched_2b_ids:
                continue

            amount_diff = abs(inv_2a.total_amount - inv_2b.total_amount)
            if amount_diff > FUZZY_AMOUNT_TOLERANCE:
                continue

            composite_b = _build_composite_string(inv_2b)
            score = fuzz.token_set_ratio(composite_a, composite_b)

            if score > best_score:
                best_score = score
                best_inv_2b = inv_2b

        matched = False

        # Check GSTIN_MISMATCH first: same invoice number, similar amount, different GSTIN
        if best_inv_2b is not None:
            gstin_match = inv_2a.gstin.upper().strip() == best_inv_2b.gstin.upper().strip()
            inv_num_match = inv_2a.normalized_invoice_number == best_inv_2b.normalized_invoice_number
            amount_diff = abs(inv_2a.total_amount - best_inv_2b.total_amount)
            if inv_num_match and amount_diff <= FUZZY_AMOUNT_TOLERANCE and not gstin_match:
                inv_2a.match_status = "GSTIN_MISMATCH"
                inv_2a.match_confidence = 75.0
                best_inv_2b.match_status = "GSTIN_MISMATCH"
                best_inv_2b.match_confidence = 75.0
                matched_2b_ids.add(str(best_inv_2b.id))
                results.append(_build_result(
                    inv_2a, best_inv_2b, "GSTIN_MISMATCH", 75.0,
                    mismatch_fields=["gstin"],
                    mismatch_reason=f"GSTIN mismatch: {inv_2a.gstin} vs {best_inv_2b.gstin}",
                ))
                matched = True

        if not matched and best_inv_2b is not None:
            if best_score >= FUZZY_MATCH_THRESHOLD:
                inv_2a.match_status = "FUZZY_MATCHED"
                inv_2a.match_confidence = best_score
                best_inv_2b.match_status = "FUZZY_MATCHED"
                best_inv_2b.match_confidence = best_score
                matched_2b_ids.add(str(best_inv_2b.id))
                results.append(_build_result(inv_2a, best_inv_2b, "FUZZY_MATCHED", best_score))
                matched = True
            elif best_score >= NEEDS_REVIEW_THRESHOLD:
                inv_2a.match_status = "NEEDS_REVIEW"
                inv_2a.match_confidence = best_score
                best_inv_2b.match_status = "NEEDS_REVIEW"
                best_inv_2b.match_confidence = best_score
                matched_2b_ids.add(str(best_inv_2b.id))
                results.append(_build_result(inv_2a, best_inv_2b, "NEEDS_REVIEW", best_score))
                matched = True

        if not matched:
            remaining_2a.append(inv_2a)

    remaining_2b = [inv for inv in unmatched_2b if str(inv.id) not in matched_2b_ids]
    return results, remaining_2a, remaining_2b


# ---------------------------------------------------------------------------
# Pass 3: Classification
# ---------------------------------------------------------------------------

async def run_classification_pass(user_id: str, period: str) -> list[dict]:
    """Pass 3: Classify remaining unmatched invoices — called standalone."""
    unmatched_2a = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2A",
        Invoice.match_status == "UNMATCHED",
    ).to_list()

    unmatched_2b = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2B",
        Invoice.match_status == "UNMATCHED",
    ).to_list()

    results = _classify(unmatched_2a, unmatched_2b)
    return [r.model_dump() for r in results]


def _classify(
    unmatched_2a: list[Invoice],
    unmatched_2b: list[Invoice],
) -> list[ReconciliationResult]:
    """Core classification logic (pure, testable)."""
    results: list[ReconciliationResult] = []

    for inv in unmatched_2a:
        inv.match_status = "MISSING_IN_2B"
        results.append(ReconciliationResult(
            gstr2a_record_id=str(inv.id) if inv.id else None,
            gstr2a_vendor_name=inv.vendor_name,
            gstr2a_vendor_gstin=inv.gstin,
            gstr2a_invoice_amount=inv.total_amount,
            gstr2a_taxable_amount=inv.taxable_amount,
            gstr2a_igst=inv.igst,
            gstr2a_cgst=inv.cgst,
            gstr2a_sgst=inv.sgst,
            match_status="MISSING_IN_2B",
            match_confidence=0.0,
        ))

    for inv in unmatched_2b:
        inv.match_status = "MISSING_IN_BOOKS"
        results.append(ReconciliationResult(
            gstr2b_record_id=str(inv.id) if inv.id else None,
            gstr2b_vendor_name=inv.vendor_name,
            gstr2b_vendor_gstin=inv.gstin,
            gstr2b_invoice_number=inv.invoice_number,
            gstr2b_invoice_value=inv.total_amount,
            gstr2b_taxable_value=inv.taxable_amount,
            gstr2b_igst=inv.igst,
            gstr2b_cgst=inv.cgst,
            gstr2b_sgst=inv.sgst,
            gstr2b_itc_availability=inv.itc_category,
            match_status="MISSING_IN_BOOKS",
            match_confidence=0.0,
        ))

    return results


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_full_matching_pipeline(user_id: str, period: str) -> dict:
    """Orchestrator: runs Pass 1 → Pass 2 → Pass 3. Returns summary stats."""
    logger.info(f"[Matching] Starting pipeline for user={user_id}, period={period}")

    # Step 0: Reset all invoices for user+period to UNMATCHED
    all_invoices = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
    ).to_list()

    if not all_invoices:
        logger.info(f"[Matching] No invoices found for user={user_id}, period={period}")
        return {
            "matched": 0,
            "fuzzy_matched": 0,
            "needs_review": 0,
            "unmatched": 0,
            "missing_in_2b": 0,
            "missing_in_books": 0,
            "value_mismatch": 0,
            "gstin_mismatch": 0,
        }

    for inv in all_invoices:
        inv.match_status = "UNMATCHED"
        inv.match_confidence = 0.0

    invoices_2a = [inv for inv in all_invoices if inv.source == "GSTR_2A"]
    invoices_2b = [inv for inv in all_invoices if inv.source == "GSTR_2B"]

    # Pass 1: Exact match
    exact_results, remaining_2a, remaining_2b = _exact_match(invoices_2a, invoices_2b)
    logger.info(
        f"[Matching] Pass 1 complete: {len(exact_results)} results, "
        f"{len(remaining_2a)} unmatched 2A, {len(remaining_2b)} unmatched 2B"
    )

    # Pass 2: Fuzzy match
    fuzzy_results, still_unmatched_2a, still_unmatched_2b = _fuzzy_match(remaining_2a, remaining_2b)
    logger.info(
        f"[Matching] Pass 2 complete: {len(fuzzy_results)} results, "
        f"{len(still_unmatched_2a)} still unmatched 2A, {len(still_unmatched_2b)} still unmatched 2B"
    )

    # Pass 3: Classification
    classification_results = _classify(still_unmatched_2a, still_unmatched_2b)
    logger.info(f"[Matching] Pass 3 complete: {len(classification_results)} classified")

    all_results = exact_results + fuzzy_results + classification_results

    # Persist all invoice status changes
    for inv in all_invoices:
        await inv.save()

    # Build summary counters
    counters = {
        "matched": 0,
        "fuzzy_matched": 0,
        "needs_review": 0,
        "unmatched": 0,
        "missing_in_2a": 0,
        "missing_in_2b": 0,
        "missing_in_books": 0,
        "value_mismatch": 0,
        "gstin_mismatch": 0,
    }
    for result in all_results:
        status = result.match_status
        if status == "MATCHED":
            counters["matched"] += 1
        elif status == "FUZZY_MATCHED":
            counters["fuzzy_matched"] += 1
        elif status == "NEEDS_REVIEW":
            counters["needs_review"] += 1
        elif status == "MISSING_IN_2B":
            counters["missing_in_2b"] += 1
        elif status == "MISSING_IN_BOOKS":
            counters["missing_in_books"] += 1
            counters["missing_in_2a"] += 1
        elif status == "VALUE_MISMATCH":
            counters["value_mismatch"] += 1
        elif status == "GSTIN_MISMATCH":
            counters["gstin_mismatch"] += 1
        else:
            counters["unmatched"] += 1

    total_eligible_itc = round(sum(r.itc_claimable_amount or 0.0 for r in all_results), 2)
    total_blocked_itc = round(sum(r.itc_blocked_amount or 0.0 for r in all_results), 2)

    # Build and persist Reconciliation document
    summary = ReconciliationSummary(
        total_invoices=len(all_invoices),
        matched_count=counters["matched"],
        fuzzy_match_count=counters["fuzzy_matched"],
        needs_review_count=counters["needs_review"],
        missing_in_2a_count=counters["missing_in_2a"],
        missing_in_2b_count=counters["missing_in_2b"],
        value_mismatch_count=counters["value_mismatch"],
        gstin_mismatch_count=counters["gstin_mismatch"],
        total_eligible_itc=total_eligible_itc,
        total_blocked_itc=total_blocked_itc,
    )

    reconciliation = Reconciliation(
        reconciliation_id=uuid.uuid4().hex,
        user_id=user_id,
        period=period,
        financial_year=derive_financial_year(period),
        status="COMPLETED",
        results=all_results,
        summary=summary,
        updated_at=datetime.utcnow(),
    )
    await reconciliation.insert()
    logger.info(
        f"[Matching] Pipeline complete for user={user_id}, period={period}: "
        f"matched={counters['matched']}, fuzzy={counters['fuzzy_matched']}, "
        f"needs_review={counters['needs_review']}, missing_in_2b={counters['missing_in_2b']}, "
        f"missing_in_books={counters['missing_in_books']}"
    )

    return counters
