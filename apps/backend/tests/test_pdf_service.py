from datetime import datetime, timezone

from app.models.reconciliation import Reconciliation, ReconciliationResult, ReconciliationSummary
from app.services.pdf_service import build_html


def test_build_html_contains_two_reports_and_table_4_summary():
    reconciliation = Reconciliation.model_construct(
        reconciliation_id="r1",
        user_id="27ABCDE1234F1Z5",
        period="2026-03",
        financial_year="2025-26",
        status="COMPLETED",
        summary=ReconciliationSummary(),
        results=[
            ReconciliationResult(match_status="EXACT_MATCH", gstr2b_igst=50, gstr2b_cgst=25, gstr2b_sgst=25),
            ReconciliationResult(
                match_status="FUZZY_MATCH",
                gstr2a_vch_no="INV002",
                gstr2a_invoice_amount=1200,
                gstr2b_invoice_value=1199,
                gstr2a_vendor_gstin="27ABCDE1234F1Z5",
                gstr2b_igst=40,
                gstr2b_cgst=20,
                gstr2b_sgst=20,
                ai_explanation="Rounded amount variance.",
            ),
            ReconciliationResult(match_status="MISSING_IN_2B", gstr2a_igst=18, gstr2a_cgst=9, gstr2a_sgst=9),
        ],
    )

    html = build_html(reconciliation, datetime.now(timezone.utc))

    assert "Report 1: Reconciliation Report (Accountant View)" in html
    assert "Report 2: GST-Ready Summary (Portal View)" in html
    assert "4(A)" in html and "4(B)" in html and "4(C)" in html
    # 4A = 100 + 80 = 180, 4B = 36, 4C = 144
    assert "₹180.00" in html
    assert "₹36.00" in html
    assert "₹144.00" in html
