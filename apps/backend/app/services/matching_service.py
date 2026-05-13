"""
3-pass matching engine for GST reconciliation.

Reconciliation is between GSTR-2A (company's inward supply register)
and GSTR-2B (government-generated static ITC statement).

Pass 1 — Exact:    GSTIN + normalized_invoice_number (total_amount ±₹1)
Pass 2 — Fuzzy:    GSTIN + RapidFuzz token_set_ratio ≥ 85%
                   on (vendor_name + invoice_number) composite,
                   with taxable_amount guard ±₹100.
                   Amount-only fallback (±₹1) when no fuzzy hit —
                   picks the closest by invoice date, not just first found.
Pass 3 — Classify:
  MISSING_IN_2B — invoice is in GSTR-2A but absent from GSTR-2B.
                  ITC cannot be claimed until the supplier files GSTR-1.
  MISSING_IN_2A — invoice is in GSTR-2B but absent from GSTR-2A.
                  Supplier has filed; company has not yet recorded the entry.
"""

import logging
import uuid
from datetime import datetime, timezone

from rapidfuzz import fuzz

from app.models.invoice import Invoice
from app.models.reconciliation import (
    Reconciliation, ReconciliationResult, ReconciliationSummary,
)
from app.utils.date_helpers import derive_financial_year

logger = logging.getLogger(__name__)

EXACT_AMOUNT_TOLERANCE = 1.0
FUZZY_SCORE_THRESHOLD  = 85
FUZZY_AMOUNT_TOLERANCE = 100.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _composite(inv: Invoice) -> str:
    return f"{inv.normalized_vendor_name or ''} {inv.normalized_invoice_number or ''}".strip()


def _diffs(a: Invoice, b: Invoice) -> dict:
    return {
        "taxable_amount_diff": round(a.taxable_amount - b.taxable_amount, 2),
        "igst_diff":           round(a.igst           - b.igst,           2),
        "cgst_diff":           round(a.cgst           - b.cgst,           2),
        "sgst_diff":           round(a.sgst           - b.sgst,           2),
        "total_amount_diff":   round(a.total_amount   - b.total_amount,   2),
    }


def _itc(inv_2b: Invoice, status: str) -> dict:
    """
    Determine ITC eligibility from the GSTR-2B invoice.

    ITC is claimable only when:
      - The invoice appears in GSTR-2B (status is EXACT_MATCH or FUZZY_MATCH).
      - GSTR-2B marks itc_availability as eligible.

    For MISSING_IN_2B: invoice is in GSTR-2A but not in GSTR-2B — ITC blocked
      (supplier has not filed GSTR-1 yet).
    For MISSING_IN_2A: invoice is in GSTR-2B but not in GSTR-2A — ITC technically
      available on portal but company has not recorded the purchase entry yet.
      We mark as eligible here because the 2B entry exists; the accountant must
      record the purchase to actually claim it.
    """
    total_tax  = round((inv_2b.igst or 0) + (inv_2b.cgst or 0) + (inv_2b.sgst or 0), 2)
    raw_cat    = (inv_2b.itc_category or "ELIGIBLE").strip().upper()

    # Normalise "Yes"/"No" strings that may come from the GSTR-2B parser
    if raw_cat in {"YES", "Y"}:
        cat = "ELIGIBLE"
    elif raw_cat in {"NO", "N"}:
        cat = "BLOCKED"
    else:
        cat = raw_cat  # already a canonical value like ELIGIBLE / BLOCKED / RCM

    is_matched  = status in {"EXACT_MATCH", "FUZZY_MATCH"}
    is_eligible = cat in {"ELIGIBLE", "CLAIMABLE"}

    if is_matched and is_eligible:
        return {
            "itc_availability":     "Yes",
            "itc_category":         cat,
            "itc_claimable_amount": total_tax,
            "itc_blocked_amount":   0.0,
        }
    return {
        "itc_availability":     "No",
        "itc_category":         cat,
        "itc_claimable_amount": 0.0,
        "itc_blocked_amount":   total_tax,
    }


def _build_result(
    inv_2a: Invoice,
    inv_2b: Invoice,
    status: str,
    confidence: float,
    mismatch_fields: list[str] | None = None,
    mismatch_reason: str | None = None,
) -> ReconciliationResult:
    return ReconciliationResult(
        gstr2a_record_id      = str(inv_2a.id) if inv_2a.id else None,
        gstr2a_vendor_name    = inv_2a.vendor_name,
        gstr2a_vendor_gstin   = inv_2a.gstin,
        gstr2a_vch_no         = inv_2a.invoice_number,
        gstr2a_invoice_number = inv_2a.invoice_number,
        gstr2a_invoice_amount = inv_2a.total_amount,
        gstr2a_taxable_amount = inv_2a.taxable_amount,
        gstr2a_igst           = inv_2a.igst,
        gstr2a_cgst           = inv_2a.cgst,
        gstr2a_sgst           = inv_2a.sgst,
        gstr2b_record_id        = str(inv_2b.id) if inv_2b.id else None,
        gstr2b_vendor_name      = inv_2b.vendor_name,
        gstr2b_vendor_gstin     = inv_2b.gstin,
        gstr2b_invoice_number   = inv_2b.invoice_number,
        gstr2b_invoice_value    = inv_2b.total_amount,
        gstr2b_taxable_value    = inv_2b.taxable_amount,
        gstr2b_igst             = inv_2b.igst,
        gstr2b_cgst             = inv_2b.cgst,
        gstr2b_sgst             = inv_2b.sgst,
        gstr2b_itc_availability = inv_2b.itc_category,
        match_status     = status,
        match_confidence = confidence,
        mismatch_fields  = mismatch_fields or [],
        mismatch_reason  = mismatch_reason,
        ai_explanation   = mismatch_reason,
        **_itc(inv_2b, status),
        **_diffs(inv_2a, inv_2b),
    )


# ── Pass 1 ────────────────────────────────────────────────────────────────────

def _exact_match(
    invoices_2a: list[Invoice],
    invoices_2b: list[Invoice],
) -> tuple[list[ReconciliationResult], list[Invoice], list[Invoice]]:
    """
    Pass 1: match on (GSTIN, normalized_invoice_number).

    EXACT_MATCH (100%)  — all diffs are zero
    EXACT_MATCH (98%)   — total_amount diff ≤ ₹1 (minor rounding)
    MISMATCH    (92%)   — key matches but amounts diverge significantly
    """
    results:        list[ReconciliationResult] = []
    matched_2b_ids: set[str]                   = set()
    remaining_2a:   list[Invoice]              = []

    b_lookup: dict[tuple[str, str], list[Invoice]] = {}
    for inv in invoices_2b:
        normalized_no = (inv.normalized_invoice_number or "").strip()
        if not normalized_no:
            continue
        key = (inv.gstin.upper().strip(), normalized_no)
        b_lookup.setdefault(key, []).append(inv)

    for inv_2a in invoices_2a:
        normalized_no = (inv_2a.normalized_invoice_number or "").strip()
        if not normalized_no:
            remaining_2a.append(inv_2a)
            continue

        key        = (inv_2a.gstin.upper().strip(), normalized_no)
        candidates = b_lookup.get(key, [])
        matched    = False

        for inv_2b in candidates:
            if str(inv_2b.id) in matched_2b_ids:
                continue

            d       = _diffs(inv_2a, inv_2b)
            nonzero = [f.replace("_diff", "") for f, v in d.items() if v != 0.0]
            all_ok  = not nonzero
            in_tol  = abs(d["total_amount_diff"]) <= EXACT_AMOUNT_TOLERANCE

            if all_ok:
                status, conf = "EXACT_MATCH", 100.0
                reason       = None
            elif in_tol:
                status, conf = "EXACT_MATCH", 98.0
                reason       = (
                    f"Minor rounding diff (≤ ₹{EXACT_AMOUNT_TOLERANCE}) "
                    f"on: {', '.join(nonzero)}."
                )
            else:
                status, conf = "MISMATCH", 92.0
                reason       = (
                    f"GSTIN + invoice number match but amounts differ on "
                    f"{', '.join(nonzero)}. "
                    f"Taxable diff = ₹{d['taxable_amount_diff']:+.2f}."
                )

            inv_2a.match_status = inv_2b.match_status = status
            inv_2a.match_confidence = inv_2b.match_confidence = conf
            matched_2b_ids.add(str(inv_2b.id))
            results.append(_build_result(
                inv_2a, inv_2b, status, conf,
                mismatch_fields=nonzero, mismatch_reason=reason,
            ))
            matched = True
            break

        if not matched:
            remaining_2a.append(inv_2a)

    remaining_2b = [inv for inv in invoices_2b if str(inv.id) not in matched_2b_ids]
    return results, remaining_2a, remaining_2b


# ── Pass 2 ────────────────────────────────────────────────────────────────────

def _fuzzy_match(
    unmatched_2a: list[Invoice],
    unmatched_2b: list[Invoice],
) -> tuple[list[ReconciliationResult], list[Invoice], list[Invoice]]:
    """
    Pass 2: fuzzy match using RapidFuzz token_set_ratio.

    Gate 1  — same GSTIN (required).
    Gate 2a — taxable diff ≤ ₹100: score composite string, accept ≥ 85%.
    Gate 2b — taxable diff ≤ ₹1  : amount-only fallback at 75% confidence.
               When multiple candidates qualify, rank by invoice date
               proximity rather than taking the first hit.
    """
    results:        list[ReconciliationResult] = []
    matched_2b_ids: set[str]                   = set()
    remaining_2a:   list[Invoice]              = []

    b_comp = {str(inv.id): _composite(inv) for inv in unmatched_2b}

    for inv_2a in unmatched_2a:
        a_comp  = _composite(inv_2a)
        gstin_a = inv_2a.gstin.upper().strip()

        best_score:  float          = -1.0
        best_inv_2b: Invoice | None = None
        best_conf:   float          = 0.0
        best_reason: str            = ""

        # Collect amount-only fallback candidates; pick closest by date later
        amt_fallback_candidates: list[tuple[int, Invoice]] = []

        for inv_2b in unmatched_2b:
            if str(inv_2b.id) in matched_2b_ids:
                continue
            if inv_2b.gstin.upper().strip() != gstin_a:
                continue

            tax_diff = abs(inv_2a.taxable_amount - inv_2b.taxable_amount)

            # Gate 2a: fuzzy string match
            if tax_diff <= FUZZY_AMOUNT_TOLERANCE:
                score = fuzz.token_set_ratio(a_comp, b_comp[str(inv_2b.id)])
                if score >= FUZZY_SCORE_THRESHOLD and score > best_score:
                    best_score  = float(score)
                    best_inv_2b = inv_2b
                    best_conf   = round(min(score, 95.0), 1)
                    best_reason = (
                        f"Fuzzy match ({score:.0f}% similarity) on vendor name / "
                        f"invoice number. Taxable diff = "
                        f"₹{inv_2a.taxable_amount - inv_2b.taxable_amount:+.2f}."
                    )

            # Gate 2b: collect amount-only fallback candidates
            if tax_diff <= EXACT_AMOUNT_TOLERANCE:
                date_diff = (
                    abs((inv_2a.invoice_date - inv_2b.invoice_date).days)
                    if inv_2a.invoice_date and inv_2b.invoice_date
                    else 9999
                )
                amt_fallback_candidates.append((date_diff, inv_2b))

        # Determine winner
        if best_inv_2b is not None:
            winner = best_inv_2b
            reason = best_reason
            conf   = best_conf
        elif amt_fallback_candidates:
            # Pick the candidate whose invoice date is closest to 2A date
            amt_fallback_candidates.sort(key=lambda t: t[0])
            winner = amt_fallback_candidates[0][1]
            conf   = 75.0
            reason = (
                "Matched by GSTIN + taxable amount tolerance (±₹1). "
                "Invoice numbers differ — please verify manually."
            )
        else:
            winner = None
            reason = ""
            conf   = 0.0

        if winner is not None:
            inv_2a.match_status     = "FUZZY_MATCH"
            inv_2a.match_confidence = conf
            winner.match_status     = "FUZZY_MATCH"
            winner.match_confidence = conf
            matched_2b_ids.add(str(winner.id))
            # REPLACE lines 304–308
            d = _diffs(inv_2a, winner)
            nonzero = [f.replace("_diff", "") for f, v in d.items() if v != 0.0]

            # Only flag invoice_number as mismatch if they actually differ
            inv_no_match = (
                inv_2a.normalized_invoice_number == winner.normalized_invoice_number
            )
            mismatch_fields = nonzero if inv_no_match else ["invoice_number"] + nonzero

            results.append(_build_result(
                inv_2a, winner, "FUZZY_MATCH", conf,
                mismatch_fields=mismatch_fields,
                mismatch_reason=reason,
            ))
            #results.append(_build_result(
            #    inv_2a, winner, "FUZZY_MATCH", conf,
            #    mismatch_fields=["invoice_number"],
            #    mismatch_reason=reason,
            #))
        else:
            remaining_2a.append(inv_2a)

    remaining_2b = [inv for inv in unmatched_2b if str(inv.id) not in matched_2b_ids]
    return results, remaining_2a, remaining_2b


# ── Pass 3 ────────────────────────────────────────────────────────────────────

def _classify(
    unmatched_2a: list[Invoice],
    unmatched_2b: list[Invoice],
) -> list[ReconciliationResult]:
    """
    Pass 3: classify invoices that could not be matched in either pass.

    MISSING_IN_2B:
        Invoice is in GSTR-2A (company's inward supply register) but absent
        from GSTR-2B (government ITC statement). This means the supplier has
        NOT yet filed their GSTR-1 for this invoice. ITC cannot be claimed
        under Section 16(2)(aa) until it appears in GSTR-2B.

    MISSING_IN_2A:
        Invoice is in GSTR-2B (supplier has filed GSTR-1) but absent from
        GSTR-2A (company's register). The company has not yet recorded this
        purchase. ITC is available on the portal and will be claimable once
        the company records the entry in their register.
    """
    results: list[ReconciliationResult] = []

    # ── MISSING_IN_2B: in GSTR-2A, not in GSTR-2B ────────────────────────────
    for inv in unmatched_2a:
        inv.match_status     = "MISSING_IN_2B"
        inv.match_confidence = 0.0
        tax = round((inv.igst or 0) + (inv.cgst or 0) + (inv.sgst or 0), 2)
        results.append(ReconciliationResult(
            gstr2a_record_id      = str(inv.id) if inv.id else None,
            gstr2a_vendor_name    = inv.vendor_name,
            gstr2a_vendor_gstin   = inv.gstin,
            gstr2a_vch_no         = inv.invoice_number,
            gstr2a_invoice_number = inv.invoice_number,
            gstr2a_invoice_amount = inv.total_amount,
            gstr2a_taxable_amount = inv.taxable_amount,
            gstr2a_igst           = inv.igst,
            gstr2a_cgst           = inv.cgst,
            gstr2a_sgst           = inv.sgst,
            match_status          = "MISSING_IN_2B",
            match_confidence      = 0.0,
            mismatch_reason       = (
                "Invoice is in GSTR-2A but not found in GSTR-2B. "
                "ITC cannot be claimed until the supplier files GSTR-1."
            ),
            ai_explanation        = (
                "Invoice is in GSTR-2A but not found in GSTR-2B. "
                "ITC cannot be claimed until the supplier files GSTR-1."
            ),
            itc_availability     = "No",
            itc_category         = "PENDING",
            itc_claimable_amount = 0.0,
            itc_blocked_amount   = tax,
        ))

    # ── MISSING_IN_2A: in GSTR-2B, not in GSTR-2A ────────────────────────────
    for inv in unmatched_2b:
        inv.match_status     = "MISSING_IN_2A"
        inv.match_confidence = 0.0
        tax     = round((inv.igst or 0) + (inv.cgst or 0) + (inv.sgst or 0), 2)
        raw_cat = (inv.itc_category or "ELIGIBLE").strip().upper()

        # Normalise raw "Yes"/"No" from GSTR-2B parser
        if raw_cat in {"YES", "Y"}:
            cat = "ELIGIBLE"
        elif raw_cat in {"NO", "N"}:
            cat = "BLOCKED"
        else:
            cat = raw_cat


        results.append(ReconciliationResult(
        gstr2b_record_id        = str(inv.id) if inv.id else None,
        gstr2b_vendor_name      = inv.vendor_name,
        gstr2b_vendor_gstin     = inv.gstin,
        gstr2b_invoice_number   = inv.invoice_number,
        gstr2b_invoice_value    = inv.total_amount,
        gstr2b_taxable_value    = inv.taxable_amount,
        gstr2b_igst             = inv.igst,
        gstr2b_cgst             = inv.cgst,
        gstr2b_sgst             = inv.sgst,
        gstr2b_itc_availability = inv.itc_category,
        match_status            = "MISSING_IN_2A",
        match_confidence        = 0.0,
        mismatch_reason         = (
            "Invoice in GSTR-2B but not recorded in books (GSTR-2A). "
            "ITC is available on portal but cannot be claimed until "
            "the purchase entry is recorded."
        ),
        ai_explanation          = (
            "Invoice in GSTR-2B but not recorded in books (GSTR-2A). "
            "ITC is available on portal but cannot be claimed until "
            "the purchase entry is recorded."
        ),
        itc_availability     = "Portal Only",  # ← distinct from "Yes"/"No"
        itc_category         = cat,
        itc_claimable_amount = 0.0,            # ← NOT claimable yet
        itc_blocked_amount   = 0.0,            # ← NOT blocked either
        # Store in a separate field so the UI can show "portal available"
        # without adding to either claimable or blocked totals
    ))

    return results


# ── Orchestrator ──────────────────────────────────────────────────────────────

def _empty_counters() -> dict:
    return {
        "matched": 0, "fuzzy_matched": 0, "needs_review": 0,
        "value_mismatch": 0, "gstin_mismatch": 0,
        "missing_in_2b": 0, "missing_in_2a": 0, "unmatched": 0,
    }


async def run_full_matching_pipeline(user_id: str, period: str) -> dict:
    logger.info(f"[Matching] Starting pipeline for user={user_id}, period={period}")

    all_invoices = await Invoice.find(
        Invoice.user_id == user_id, Invoice.period == period,
    ).to_list()

    if not all_invoices:
        logger.info(f"[Matching] No invoices found for user={user_id}, period={period}")
        return _empty_counters()

    for inv in all_invoices:
        inv.match_status     = "UNMATCHED"
        inv.match_confidence = 0.0

    invoices_2a = [inv for inv in all_invoices if inv.source == "GSTR_2A"]
    invoices_2b = [inv for inv in all_invoices if inv.source == "GSTR_2B"]
    logger.info(
        f"[Matching] Pool: {len(invoices_2a)} GSTR-2A, {len(invoices_2b)} GSTR-2B"
    )

    exact_r, rem_2a, rem_2b = _exact_match(invoices_2a, invoices_2b)
    logger.info(f"[Matching] Pass 1: {len(exact_r)} matched, "
                f"{len(rem_2a)} 2A remaining, {len(rem_2b)} 2B remaining")

    fuzzy_r, still_2a, still_2b = _fuzzy_match(rem_2a, rem_2b)
    logger.info(f"[Matching] Pass 2: {len(fuzzy_r)} fuzzy matched, "
                f"{len(still_2a)} 2A unmatched, {len(still_2b)} 2B unmatched")

    class_r = _classify(still_2a, still_2b)
    logger.info(f"[Matching] Pass 3: {len(class_r)} classified")

    all_results = exact_r + fuzzy_r + class_r

    for inv in all_invoices:
        await inv.save()

    counters = _empty_counters()
    for r in all_results:
        s = r.match_status
        if   s == "EXACT_MATCH":   counters["matched"]        += 1
        elif s == "FUZZY_MATCH":   counters["fuzzy_matched"]  += 1
        elif s == "MISMATCH":      counters["value_mismatch"] += 1
        elif s == "NEEDS_REVIEW":  counters["needs_review"]   += 1
        elif s == "MISSING_IN_2B": counters["missing_in_2b"]  += 1
        elif s == "MISSING_IN_2A": counters["missing_in_2a"]  += 1
        elif s == "GSTIN_MISMATCH":counters["gstin_mismatch"] += 1
        else:                      counters["unmatched"]      += 1

    # ITC totals — compute separately so blocked ≠ ineligible
    # REPLACE lines 478–486
    claimable = round(sum(
        r.itc_claimable_amount or 0
        for r in all_results
        if r.match_status in {"EXACT_MATCH", "FUZZY_MATCH", "MISMATCH"}
    ), 2)

    blocked = round(sum(
        r.itc_blocked_amount or 0
        for r in all_results
        if r.itc_category in {"BLOCKED", "INELIGIBLE", "PENDING"}
    ), 2)

    # ITC available on portal but not yet claimable (purchase not recorded)
    portal_available = round(sum(
        (r.gstr2b_igst or 0) + (r.gstr2b_cgst or 0) + (r.gstr2b_sgst or 0)
        for r in all_results
        if r.match_status == "MISSING_IN_2A"
        and r.itc_category in {"ELIGIBLE", "CLAIMABLE"}
    ), 2)

    ineligible = round(sum(
        r.itc_blocked_amount or 0
        for r in all_results
        if r.itc_category == "BLOCKED"
    ), 2)

    for old in await Reconciliation.find(
        Reconciliation.user_id == user_id, Reconciliation.period == period,
    ).to_list():
        await old.delete()

    summary = ReconciliationSummary(
        total_invoices       = len(all_invoices),
        matched_count        = counters["matched"],
        fuzzy_match_count    = counters["fuzzy_matched"],
        needs_review_count   = counters["needs_review"],
        missing_in_2b_count  = counters["missing_in_2b"],
        missing_in_2a_count  = counters["missing_in_2a"],
        value_mismatch_count = counters["value_mismatch"],
        gstin_mismatch_count = counters["gstin_mismatch"],
        total_eligible_itc   = claimable,
        total_blocked_itc    = blocked,
        total_ineligible_itc = ineligible,
        portal_available_itc   = portal_available,
    )
    await Reconciliation(
        reconciliation_id = uuid.uuid4().hex,
        user_id           = user_id,
        period            = period,
        financial_year    = derive_financial_year(period),
        status            = "COMPLETED",
        results           = all_results,
        summary           = summary,
        updated_at        = datetime.now(timezone.utc),
    ).insert()

    logger.info(
        f"[Matching] Done: exact={counters['matched']}, fuzzy={counters['fuzzy_matched']}, "
        f"mismatch={counters['value_mismatch']}, "
        f"missing_in_2b={counters['missing_in_2b']}, missing_in_2a={counters['missing_in_2a']}, "
        f"ITC claimable=₹{claimable}, blocked=₹{blocked}"
    )
    return counters


# ── Standalone entry points ───────────────────────────────────────────────────

async def run_exact_match_pass(user_id: str, period: str) -> list[dict]:
    a = await Invoice.find(Invoice.user_id==user_id, Invoice.period==period, Invoice.source=="GSTR_2A").to_list()
    b = await Invoice.find(Invoice.user_id==user_id, Invoice.period==period, Invoice.source=="GSTR_2B").to_list()
    r, _, _ = _exact_match(a, b)
    return [x.model_dump() for x in r]

async def run_fuzzy_match_pass(user_id: str, period: str) -> list[dict]:
    a = await Invoice.find(Invoice.user_id==user_id, Invoice.period==period, Invoice.source=="GSTR_2A", Invoice.match_status=="UNMATCHED").to_list()
    b = await Invoice.find(Invoice.user_id==user_id, Invoice.period==period, Invoice.source=="GSTR_2B", Invoice.match_status=="UNMATCHED").to_list()
    r, _, _ = _fuzzy_match(a, b)
    return [x.model_dump() for x in r]

async def run_classification_pass(user_id: str, period: str) -> list[dict]:
    a = await Invoice.find(Invoice.user_id==user_id, Invoice.period==period, Invoice.source=="GSTR_2A", Invoice.match_status=="UNMATCHED").to_list()
    b = await Invoice.find(Invoice.user_id==user_id, Invoice.period==period, Invoice.source=="GSTR_2B", Invoice.match_status=="UNMATCHED").to_list()
    return [x.model_dump() for x in _classify(a, b)]