"""
Process service — Orchestrates the full reconciliation pipeline.

Pipeline (synchronous, must complete within HTTP timeout):
  1. Fetch all GSTR-2A / GSTR-2B records for the user.
  2. Resolve the effective tax period (YYYY-MM).
  3. Filter both sets to that period.
  4. Map records → Invoice documents.
  5. Delete existing invoices for user+period (idempotent re-runs).
  6. Insert standardized invoices.
  7. Run the 3-pass matching pipeline.
  8. Return ProcessResponse immediately.

AI explanation generation is intentionally NOT awaited here.
It is triggered as a fire-and-forget background task from the route layer
(process.py) so it never blocks the HTTP response.
"""

import logging
from datetime import datetime, timezone, date as date_type

from app.models.gstr2a import Gstr2ARecord
from app.models.gstr2b import Gstr2BRecord
from app.models.invoice import Invoice
from app.models.reconciliation import Reconciliation
from app.services.standardize_service import batch_standardize
from app.services.matching_service import run_full_matching_pipeline
from app.schemas.api import ProcessResponse
from app.utils.date_helpers import parse_gst_date, to_period, derive_financial_year

logger = logging.getLogger(__name__)

MONTH_NAME_MAP = {
    "january": 1,  "february": 2,  "march": 3,    "april": 4,
    "may": 5,       "june": 6,      "july": 7,     "august": 8,
    "september": 9, "october": 10,  "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_date(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    if isinstance(value, date_type):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    try:
        return parse_gst_date(str(value).strip())
    except (ValueError, TypeError):
        return None


def _gstr2b_period_to_yyyy_mm(tax_period: str, financial_year: str) -> str:
    if not tax_period or not financial_year:
        return ""
    month_num = MONTH_NAME_MAP.get(tax_period.strip().lower())
    if not month_num:
        return ""
    try:
        start_year = int(financial_year.strip().split("-")[0])
        year = start_year if month_num >= 4 else start_year + 1
        return f"{year}-{month_num:02d}"
    except (ValueError, IndexError):
        return ""


def _resolve_effective_period(
    requested_period: str,
    all_2a_records: list[Gstr2ARecord],
    all_2b_records: list[Gstr2BRecord],
) -> str:
    if requested_period:
        return requested_period

    periods_2a: set[str] = set()
    for rec in all_2a_records:
        dt = _safe_date(rec.date)
        if dt:
            try:
                periods_2a.add(to_period(dt))
            except Exception:
                pass

    periods_2b: set[str] = set()
    for rec in all_2b_records:
        period = _gstr2b_period_to_yyyy_mm(rec.tax_period, rec.financial_year)
        if not period:
            dt = _safe_date(rec.invoice_date)
            if dt:
                try:
                    period = to_period(dt)
                except Exception:
                    pass
        if period:
            periods_2b.add(period)

    logger.info(
        f"[Process] Period candidates — 2A: {sorted(periods_2a)}, 2B: {sorted(periods_2b)}"
    )
    common   = sorted(periods_2a & periods_2b, reverse=True)
    fallback = sorted(periods_2a | periods_2b, reverse=True)
    return common[0] if common else (fallback[0] if fallback else "")


def _normalise_itc_category(raw: str | None) -> str:
    """Map raw GSTR-2B portal value ("Yes"/"No") to canonical internal category."""
    val = (raw or "").strip().upper()
    if val in {"YES", "Y"}:
        return "ELIGIBLE"
    if val in {"NO", "N"}:
        return "BLOCKED"
    if val in {"ELIGIBLE", "CLAIMABLE", "BLOCKED", "RCM", "INELIGIBLE", "PENDING"}:
        return val
    return "ELIGIBLE"


# ── Background AI enrichment (called by route, not awaited in pipeline) ───────

async def enrich_with_ai_explanations(user_id: str, period: str) -> None:

    """
    Fire-and-forget: fetch the reconciliation document and enrich results
    with AI explanations. Runs after the HTTP response has been sent.
    Never raises — all errors are logged and swallowed.
    """
    from app.services import ai_explanation_service  # local import avoids circular deps
    try:
        reconciliation = await Reconciliation.find_one(
            Reconciliation.user_id == user_id,
            Reconciliation.period  == period,
        )
        if not reconciliation:
            logger.warning(
                f"[Process/AI] Reconciliation not found for user={user_id}, period={period}"
            )
            return

        explanations, ai_count = await ai_explanation_service.generate_explanations_for_reconciliation(
            reconciliation
        )
        for i, result in enumerate(reconciliation.results):
            if i < len(explanations):
                result.ai_explanation = explanations[i]
        await reconciliation.save()
        logger.info(
            f"[Process/AI] Explanations saved: {ai_count} AI-generated, "
            f"{len(explanations) - ai_count} template-generated."
        )
    except Exception as exc:
        logger.error(f"[Process/AI] Background AI enrichment failed (non-fatal): {exc}")


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_reconciliation(user_id: str, period: str) -> ProcessResponse:
    """
    Run the full reconciliation pipeline and return immediately.
    AI explanations are NOT generated here — they run in a background task
    triggered by the route layer after this function returns.
    """
    logger.info(f"[Process] Starting reconciliation for user={user_id}, period={period!r}")

    # ── 1. Fetch ──────────────────────────────────────────────────────────────
    all_2a_records = await Gstr2ARecord.find(Gstr2ARecord.user_id == user_id).to_list()
    all_2b_records = await Gstr2BRecord.find(Gstr2BRecord.user_id == user_id).to_list()
    logger.info(
        f"[Process] Fetched {len(all_2a_records)} GSTR-2A, "
        f"{len(all_2b_records)} GSTR-2B records"
    )

    # ── 2. Resolve period ─────────────────────────────────────────────────────
    period = _resolve_effective_period(period, all_2a_records, all_2b_records)
    if not period:
        raise ValueError(
            "Could not determine a tax period from the uploaded files. "
            "Please upload both GSTR-2A and GSTR-2B files."
        )
    financial_year = derive_financial_year(period)
    logger.info(f"[Process] Resolved period={period}, FY={financial_year}")

    # ── 3. Filter GSTR-2A ─────────────────────────────────────────────────────
    gstr2a_records: list[Gstr2ARecord] = []
    for rec in all_2a_records:
        dt = _safe_date(rec.date)
        if dt:
            try:
                if to_period(dt) == period:
                    gstr2a_records.append(rec)
            except Exception:
                logger.warning(f"[Process] Cannot derive period from date={rec.date!r}")
        else:
            logger.debug(f"[Process] Skipping record with invalid date: {rec.date!r}")

    # ── 4. Filter GSTR-2B ─────────────────────────────────────────────────────
    gstr2b_records: list[Gstr2BRecord] = []
    for rec in all_2b_records:
        rec_period = _gstr2b_period_to_yyyy_mm(rec.tax_period, rec.financial_year)
        if not rec_period:
            dt = _safe_date(rec.invoice_date)
            if dt:
                try:
                    rec_period = to_period(dt)
                except Exception:
                    rec_period = ""
        if rec_period == period:
            gstr2b_records.append(rec)

    logger.info(
        f"[Process] After filter: "
        f"{len(gstr2a_records)} GSTR-2A + {len(gstr2b_records)} GSTR-2B"
    )

    if not gstr2a_records and not gstr2b_records:
        raise ValueError(
            f"No records found for period {period}. "
            "Check that your uploaded files contain data for this period."
        )

    # ── 5. Map GSTR-2A → Invoice ──────────────────────────────────────────────
    gstr2a_invoices: list[Invoice] = []
    for rec in gstr2a_records:
        dt       = _safe_date(rec.date) or datetime.now(timezone.utc)
        official = (rec.invoice_number or "").strip()
        voucher  = (rec.vch_no or "").strip()
        inv_num  = official or voucher
        gstr2a_invoices.append(Invoice(
            user_id        = user_id,
            source         = "GSTR_2A",
            gstin          = (rec.party_gstin or "").strip().upper(),
            vendor_name    = rec.particulars or "",
            invoice_number = inv_num,
            invoice_date   = dt,
            period         = period,
            taxable_amount = round(rec.taxable_amount, 2),
            igst           = round(rec.igst, 2),
            cgst           = round(rec.cgst, 2),
            sgst           = round(rec.sgst_utgst, 2),
            cess           = round(rec.cess, 2),
            total_amount   = round(rec.invoice_amount, 2),
        ))

    # ── 6. Map GSTR-2B → Invoice ──────────────────────────────────────────────
    gstr2b_invoices: list[Invoice] = []
    for rec in gstr2b_records:
        dt = _safe_date(rec.invoice_date) or datetime.now(timezone.utc)
        gstr2b_invoices.append(Invoice(
            user_id        = user_id,
            source         = "GSTR_2B",
            gstin          = (rec.supplier_gstin or "").strip().upper(),
            vendor_name    = rec.supplier_trade_name or "",
            invoice_number = rec.invoice_number or "",
            invoice_date   = dt,
            period         = period,
            taxable_amount = round(rec.taxable_value, 2),
            igst           = round(rec.integrated_tax, 2),
            cgst           = round(rec.central_tax, 2),
            sgst           = round(rec.state_ut_tax, 2),
            cess           = round(rec.cess, 2),
            total_amount   = round(rec.invoice_value, 2),
            itc_category   = _normalise_itc_category(rec.itc_availability),
        ))

    # ── 7. Standardize ────────────────────────────────────────────────────────
    all_invoices = batch_standardize(gstr2a_invoices + gstr2b_invoices)

    # ── 8. Delete existing (idempotent) ───────────────────────────────────────
    deleted = await Invoice.find(
        Invoice.user_id == user_id, Invoice.period == period
    ).delete()
    if deleted and deleted.deleted_count:
        logger.info(f"[Process] Deleted {deleted.deleted_count} existing invoices")

    # ── 9. Insert ─────────────────────────────────────────────────────────────
    if all_invoices:
        await Invoice.insert_many(all_invoices)
        logger.info(f"[Process] Inserted {len(all_invoices)} standardized invoices")

    # ── 10. Match ─────────────────────────────────────────────────────────────
    matching_summary = await run_full_matching_pipeline(user_id, period)

    # ── 11. Return immediately — AI runs in background ────────────────────────
    # The route layer (process.py) schedules enrich_with_ai_explanations()
    # as a FastAPI BackgroundTask after this response is sent.
    total_2a = len(gstr2a_invoices)
    total_2b = len(gstr2b_invoices)
    return ProcessResponse(
        success = True,
        message = (
            f"Reconciliation complete for period {period} (FY {financial_year}). "
            f"Processed {total_2a} GSTR-2A + {total_2b} GSTR-2B = "
            f"{len(all_invoices)} total invoices. "
            f"AI explanations are being generated in the background."
        ),
        summary = {
            **matching_summary,
            "total_invoices": len(all_invoices),
            "gstr2a_count":   total_2a,
            "gstr2b_count":   total_2b,
            "period":         period,
            "financial_year": financial_year,
        },
    )