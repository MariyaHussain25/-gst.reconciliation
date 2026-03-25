"""Pydantic schemas for AI Explanation API — Phase 7"""

from typing import List, Optional
from pydantic import BaseModel


class ExplainResultItem(BaseModel):
    """Single reconciliation result with its AI explanation."""
    index: int
    match_status: str
    gstr2a_vendor_name: Optional[str] = None
    gstr2b_vendor_name: Optional[str] = None
    gstr2b_invoice_number: Optional[str] = None
    total_amount_diff: float = 0.0
    itc_category: str = "ELIGIBLE"
    ai_explanation: Optional[str] = None


class ExplainResponse(BaseModel):
    """Response for POST /api/explain/{reconciliation_id} — trigger generation."""
    success: bool
    reconciliation_id: str
    results_explained: int
    message: str


class ExplainResultsResponse(BaseModel):
    """Response for GET /api/explain/{reconciliation_id} — fetch with explanations."""
    success: bool
    reconciliation_id: str
    period: str
    status: str
    total_results: int
    results: List[ExplainResultItem]
