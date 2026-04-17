"""
Process service — Phase 4 Complete Implementation
Orchestrates the reconciliation pipeline:
1. Fetch GSTR-2A records (filter by period derived from period_end)
2. Fetch GSTR-2B records (filter by FY + tax_period → YYYY-MM conversion)
3. Map both to standardized Invoice documents
4. Delete existing invoices for user+period (idempotent re-runs)
5. Insert standardized invoices
6. Run matching pipeline (Phase 5 placeholder)
"""

import logging
from datetime import datetime, timezone
from app.models.gstr2a import Gstr2ARecord
from app.models.gstr2b import Gstr2BRecord
from app.models.invoice import Invoice
from app.services.standardize_service import batch_standardize
from app.services.matching_service import run_full_matching_pipeline
from app.schemas.api import ProcessResponse
from app.utils.date_helpers import parse_gst_date, to_period, derive_financial_year

logger = logging.getLogger(__name__)

# Month name to number mapping for GSTR-2B tax_period conversion
MONTH_NAME_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}


def _gstr2b_period_to_yyyy_mm(tax_period: str, financial_year: str) -> str:
    """
    Convert GSTR-2B tax_period + financial_year to YYYY-MM.
    Example: tax_period='March', financial_year='2022-23' → '2023-03'

    In Indian FY (Apr-Mar):
    - Apr-Dec belong to the FIRST calendar year of the FY
    - Jan-Mar belong to the SECOND calendar year of the FY
    """
    if not tax_period or not financial_year:
        return ""

    month_num = MONTH_NAME_MAP.get(tax_period.strip().lower())
    if not month_num:
        return ""

    try:
        # Parse FY like "2022-23" → start_year=2022
        fy_parts = financial_year.strip().split("-")
        start_year = int(fy_parts[0])

        if month_num >= 4:
            # Apr-Dec → first calendar year
            year = start_year
        else:
            # Jan-Mar → second calendar year
            year = start_year + 1

        return f"{year}-{month_num:02d}"
    except (ValueError, IndexError):
        return ""


def _resolve_effective_period(requested_period: str, all_2a_records: list[Gstr2ARecord], all_2b_records: list[Gstr2BRecord]) -> str:
    """Resolve the period when client doesn't provide one."""
    if requested_period:
        return requested_period

    periods_2a: set[str] = set()
    for rec in all_2a_records:
        try:
            if rec.date:
                periods_2a.add(to_period(parse_gst_date(rec.date)))
        except (ValueError, TypeError):
            continue

    periods_2b: set[str] = set()
    for rec in all_2b_records:
        period = _gstr2b_period_to_yyyy_mm(rec.tax_period, rec.financial_year)
        if period:
            periods_2b.add(period)

    common = sorted(periods_2a & periods_2b, reverse=True)
    if common:
        return common[0]

    fallback = sorted(periods_2a | periods_2b, reverse=True)
    return fallback[0] if fallback else ""


async def run_reconciliation(user_id: str, period: str) -> ProcessResponse:
    """Run the full reconciliation pipeline for a user and period.

    Args:
        user_id: The user's ID
        period: Period in YYYY-MM format (e.g., '2023-03')
    """
    logger.info(f"[Process] Starting reconciliation for user={user_id}, period={period}")

    # Step 1: Fetch records for user
    all_2a_records = await Gstr2ARecord.find(
        Gstr2ARecord.user_id == user_id
    ).to_list()
    all_2b_records = await Gstr2BRecord.find(
        Gstr2BRecord.user_id == user_id
    ).to_list()

    period = _resolve_effective_period(period, all_2a_records, all_2b_records)
    if not period:
        raise ValueError("No invoices found for reconciliation. Please upload Books and GSTR-2B files.")

    financial_year = derive_financial_year(period)

    gstr2a_records = []
    for rec in all_2a_records:
        try:
            rec_date = parse_gst_date(rec.date) if rec.date else None
            if rec_date and to_period(rec_date) == period:
                gstr2a_records.append(rec)
        except (ValueError, TypeError):
            # Cannot verify period for records with unparseable dates — skip them
            logger.warning(f"[Process] Skipping GSTR-2A record with unparseable date: {rec.date!r}")

    # Step 2: Filter GSTR-2B records by FY + tax_period → YYYY-MM
    gstr2b_records = []
    for rec in all_2b_records:
        rec_period = _gstr2b_period_to_yyyy_mm(rec.tax_period, rec.financial_year)
        if rec_period == period:
            gstr2b_records.append(rec)

    logger.info(
        f"[Process] Found {len(gstr2a_records)} GSTR-2A + {len(gstr2b_records)} GSTR-2B records for period {period}"
    )

    # Step 3: Map GSTR-2A records to Invoice documents
    gstr2a_invoices: list[Invoice] = []
    for rec in gstr2a_records:
        try:
            invoice_date = parse_gst_date(rec.date) if rec.date else datetime.now(timezone.utc)
        except (ValueError, TypeError):
            invoice_date = datetime.now(timezone.utc)

        inv = Invoice(
            user_id=user_id,
            source="GSTR_2A",
            gstin=rec.party_gstin or "",
            vendor_name=rec.particulars or "",
            invoice_number=(rec.vch_no or ""),
            invoice_date=invoice_date,
            period=period,
            taxable_amount=round(rec.taxable_amount, 2),
            igst=round(rec.igst, 2),
            cgst=round(rec.cgst, 2),
            sgst=round(rec.sgst_utgst, 2),
            cess=round(rec.cess, 2),
            total_amount=round(rec.invoice_amount, 2),
        )
        gstr2a_invoices.append(inv)

    # Step 4: Map GSTR-2B records to Invoice documents
    gstr2b_invoices: list[Invoice] = []
    for rec in gstr2b_records:
        try:
            invoice_date = parse_gst_date(rec.invoice_date) if rec.invoice_date else datetime.now(timezone.utc)
        except (ValueError, TypeError):
            invoice_date = datetime.now(timezone.utc)

        inv = Invoice(
            user_id=user_id,
            source="GSTR_2B",
            gstin=rec.supplier_gstin or "",
            vendor_name=rec.supplier_trade_name or "",
            invoice_number=rec.invoice_number or "",
            invoice_date=invoice_date,
            period=period,
            taxable_amount=round(rec.taxable_value, 2),
            igst=round(rec.integrated_tax, 2),
            cgst=round(rec.central_tax, 2),
            sgst=round(rec.state_ut_tax, 2),
            cess=round(rec.cess, 2),
            total_amount=round(rec.invoice_value, 2),
            itc_category=(rec.itc_availability or "ELIGIBLE"),
        )
        gstr2b_invoices.append(inv)

    # Step 5: Standardize all invoices (normalize names, numbers, recompute totals)
    all_invoices = batch_standardize(gstr2a_invoices + gstr2b_invoices)

    # Step 6: Delete existing invoices for this user+period (idempotent re-runs)
    deleted = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
    ).delete()
    if deleted and deleted.deleted_count:
        logger.info(
            f"[Process] Deleted {deleted.deleted_count} existing invoices for user={user_id}, period={period}"
        )

    # Step 7: Persist standardized Invoice documents
    if all_invoices:
        await Invoice.insert_many(all_invoices)
        logger.info(f"[Process] Inserted {len(all_invoices)} standardized invoices")

    # Step 8: Run matching pipeline (Phase 5 placeholder — returns zeros for now)
    matching_summary = await run_full_matching_pipeline(user_id, period)

    # Step 9: Return ProcessResponse
    total_2a = len(gstr2a_invoices)
    total_2b = len(gstr2b_invoices)
    return ProcessResponse(
        success=True,
        message=(
            f"Reconciliation complete for period {period} (FY {financial_year}). "
            f"Processed {total_2a} GSTR-2A + {total_2b} GSTR-2B = {len(all_invoices)} total invoices."
        ),
        summary={
            **matching_summary,
            "total_invoices": len(all_invoices),
            "gstr2a_count": total_2a,
            "gstr2b_count": total_2b,
            "period": period,
            "financial_year": financial_year,
        },
    )
