import io
import logging
from typing import Any, Dict
import pandas as pd
from app.models.reconciliation import Reconciliation

logger = logging.getLogger(__name__)

async def generate_reconciliation_excel(reconciliation: Reconciliation) -> io.BytesIO:
    data = [{
        "Match Status": r.match_status,
        "Invoice Number": r.gstr2b_invoice_number or r.gstr2a_vch_no,
        "GSTR-2A Vendor": r.gstr2a_vendor_name,
        "GSTR-2B Vendor": r.gstr2b_vendor_name,
        "Total Diff": r.total_amount_diff,
        "ITC Category": r.itc_category,
        "ITC Availability": r.itc_availability,
        "AI Explanation": r.ai_explanation,
    } for r in reconciliation.results]
    
    df = pd.DataFrame(data)
    if df.empty:
        df = pd.DataFrame(columns=["Match Status", "Invoice Number", "Total Diff", "AI Explanation"])

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="All Invoices", index=False)
        if not df.empty:
            df[df["Match Status"] == "MATCHED"].to_excel(writer, sheet_name="Matched", index=False)
            df[df["Match Status"].isin(["VALUE_MISMATCH", "GSTIN_MISMATCH"])].to_excel(
                writer, sheet_name="Mismatched", index=False
            )
    
    output.seek(0)
    return output

async def generate_gst_summary_json(reconciliation: Reconciliation) -> Dict[str, Any]:
    gstin = reconciliation.user_id
    if not gstin and reconciliation.results:
        first_result = reconciliation.results[0]
        gstin = first_result.gstr2a_vendor_gstin or first_result.gstr2b_vendor_gstin or ""

    return {
        "gstin": gstin,
        "return_period": reconciliation.period,
        "table_4_summary": "Auto-calculated based on eligible/blocked ITC"
    }
