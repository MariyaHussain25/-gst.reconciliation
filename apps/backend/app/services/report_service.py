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
            df[df["Match Status"].isin(["MATCHED", "EXACT_MATCH"])].to_excel(writer, sheet_name="Matched", index=False)
            df[df["Match Status"].isin(["VALUE_MISMATCH", "GSTIN_MISMATCH", "FUZZY_MATCH", "MISSING_IN_2B", "MISSING_IN_BOOKS"])].to_excel(
                writer, sheet_name="Mismatched", index=False
            )
    
    output.seek(0)
    return output

async def generate_gst_summary_json(reconciliation: Reconciliation) -> Dict[str, Any]:
    def _tax_total(result) -> float:
        if result.gstr2b_igst is not None or result.gstr2b_cgst is not None or result.gstr2b_sgst is not None:
            return round((result.gstr2b_igst or 0.0) + (result.gstr2b_cgst or 0.0) + (result.gstr2b_sgst or 0.0), 2)
        return round((result.gstr2a_igst or 0.0) + (result.gstr2a_cgst or 0.0) + (result.gstr2a_sgst or 0.0), 2)

    table_4a = round(sum(_tax_total(r) for r in reconciliation.results if r.match_status in {"EXACT_MATCH", "FUZZY_MATCH"}), 2)
    table_4b = round(sum(_tax_total(r) for r in reconciliation.results if r.match_status in {"MISSING_IN_2B", "MISSING_IN_BOOKS"}), 2)
    table_4c = round(table_4a - table_4b, 2)

    return {
        "gstin": reconciliation.user_id,
        "return_period": reconciliation.period,
        "table_4": {
            "4A_itc_available": table_4a,
            "4B_itc_reversed": table_4b,
            "4C_net_itc_available": table_4c,
        },
    }
