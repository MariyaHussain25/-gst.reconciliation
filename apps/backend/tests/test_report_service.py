import pandas as pd
import pytest

from app.models.reconciliation import Reconciliation, ReconciliationResult
from app.services.report_service import generate_gst_summary_json, generate_reconciliation_excel


@pytest.mark.asyncio
async def test_generate_reconciliation_excel_mismatched_sheet_filters_value_and_gstin_mismatch():
    reconciliation = Reconciliation.model_construct(
        reconciliation_id="r1",
        user_id="27AAPFU0939F1ZV",
        period="2025-01",
        financial_year="2024-25",
        status="COMPLETED",
        results=[
            ReconciliationResult(match_status="MATCHED", gstr2b_invoice_number="1"),
            ReconciliationResult(match_status="VALUE_MISMATCH", gstr2b_invoice_number="2"),
            ReconciliationResult(match_status="GSTIN_MISMATCH", gstr2b_invoice_number="3"),
        ],
    )

    excel_buffer = await generate_reconciliation_excel(reconciliation)
    mismatched_df = pd.read_excel(excel_buffer, sheet_name="Mismatched")

    assert sorted(mismatched_df["Match Status"].tolist()) == ["GSTIN_MISMATCH", "VALUE_MISMATCH"]


@pytest.mark.asyncio
async def test_generate_gst_summary_json_uses_reconciliation_user_id_as_gstin():
    reconciliation = Reconciliation.model_construct(
        reconciliation_id="r2",
        user_id="27AAPFU0939F1ZV",
        period="2025-01",
        financial_year="2024-25",
        status="COMPLETED",
        results=[],
    )

    summary = await generate_gst_summary_json(reconciliation)
    assert summary["gstin"] == "27AAPFU0939F1ZV"
