"""
Process service - rewrite of process.service.ts
Orchestrates the reconciliation pipeline.
"""

from datetime import datetime
from app.models.gstr2a import Gstr2ARecord
from app.models.gstr2b import Gstr2BRecord
from app.models.invoice import Invoice
from app.services.standardize_service import batch_standardize
from app.services.matching_service import run_full_matching_pipeline
from app.schemas.api import ProcessResponse


async def run_reconciliation(user_id: str, period: str) -> ProcessResponse:
    """Run the full reconciliation pipeline for a user and period."""
    # Step 1: Fetch GSTR-2A records for user+period
    gstr2a_records = await Gstr2ARecord.find(
        Gstr2ARecord.user_id == user_id
    ).to_list()

    # Step 2: Fetch GSTR-2B records for user+period
    year_month = period  # YYYY-MM
    year = year_month[:4] if len(year_month) >= 4 else ""
    gstr2b_records = await Gstr2BRecord.find(
        Gstr2BRecord.user_id == user_id
    ).to_list()

    # Step 3: Map GSTR-2A records to Invoice documents
    gstr2a_invoices: list[Invoice] = []
    for rec in gstr2a_records:
        try:
            invoice_date = datetime.strptime(rec.date, "%d-%b-%y") if rec.date else datetime.utcnow()
        except (ValueError, TypeError):
            invoice_date = datetime.utcnow()

        inv = Invoice(
            user_id=user_id,
            source="GSTR_2A",
            gstin=rec.party_gstin,
            vendor_name=rec.particulars,
            normalized_vendor_name="",
            invoice_number=str(rec.vch_no),
            normalized_invoice_number="",
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
            invoice_date = datetime.strptime(rec.invoice_date, "%d/%m/%Y") if rec.invoice_date else datetime.utcnow()
        except (ValueError, TypeError):
            invoice_date = datetime.utcnow()

        inv = Invoice(
            user_id=user_id,
            source="GSTR_2B",
            gstin=rec.supplier_gstin,
            vendor_name=rec.supplier_trade_name,
            normalized_vendor_name="",
            invoice_number=rec.invoice_number,
            normalized_invoice_number="",
            invoice_date=invoice_date,
            period=period,
            taxable_amount=round(rec.taxable_value, 2),
            igst=round(rec.integrated_tax, 2),
            cgst=round(rec.central_tax, 2),
            sgst=round(rec.state_ut_tax, 2),
            cess=round(rec.cess, 2),
            total_amount=round(rec.invoice_value, 2),
        )
        gstr2b_invoices.append(inv)

    # Step 5: Standardize all invoices
    all_invoices = batch_standardize(gstr2a_invoices + gstr2b_invoices)

    # Step 6: Persist standardized Invoice documents
    if all_invoices:
        await Invoice.insert_many(all_invoices)

    # Step 7: Run matching pipeline (placeholder for Phase 5)
    matching_summary = await run_full_matching_pipeline(user_id, period)

    # Step 8: Return ProcessResponse
    return ProcessResponse(
        success=True,
        message=f"Reconciliation complete for period {period}. Processed {len(all_invoices)} invoices.",
        summary=matching_summary,
    )
