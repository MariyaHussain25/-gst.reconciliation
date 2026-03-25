"""Reconciliation document model - replaces reconciliation.model.ts"""

from datetime import datetime
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class ReconciliationResult(BaseModel):
    # GSTR-2A fields
    gstr2a_record_id: Optional[str] = None
    gstr2a_vendor_name: Optional[str] = None
    gstr2a_vendor_gstin: Optional[str] = None
    gstr2a_vch_no: Optional[int] = None
    gstr2a_invoice_amount: Optional[float] = None
    gstr2a_taxable_amount: Optional[float] = None
    gstr2a_igst: Optional[float] = None
    gstr2a_cgst: Optional[float] = None
    gstr2a_sgst: Optional[float] = None

    # GSTR-2B fields
    gstr2b_record_id: Optional[str] = None
    gstr2b_vendor_name: Optional[str] = None
    gstr2b_vendor_gstin: Optional[str] = None
    gstr2b_invoice_number: Optional[str] = None
    gstr2b_invoice_value: Optional[float] = None
    gstr2b_taxable_value: Optional[float] = None
    gstr2b_igst: Optional[float] = None
    gstr2b_cgst: Optional[float] = None
    gstr2b_sgst: Optional[float] = None
    gstr2b_itc_availability: Optional[str] = None

    # Match fields
    match_status: str = "UNMATCHED"
    match_confidence: float = 0.0
    mismatch_fields: List[str] = Field(default_factory=list)
    mismatch_reason: Optional[str] = None

    # Diff fields
    taxable_amount_diff: float = 0.0
    igst_diff: float = 0.0
    cgst_diff: float = 0.0
    sgst_diff: float = 0.0
    total_amount_diff: float = 0.0

    # ITC fields
    itc_availability: str = "Pending"
    itc_category: str = "ELIGIBLE"
    itc_claimable_amount: float = 0.0
    itc_blocked_amount: float = 0.0

    # AI field (Phase 7 placeholder)
    ai_explanation: Optional[str] = None


class ReconciliationSummary(BaseModel):
    total_invoices: int = 0
    matched_count: int = 0
    fuzzy_match_count: int = 0
    needs_review_count: int = 0
    missing_in_2a_count: int = 0
    missing_in_2b_count: int = 0
    value_mismatch_count: int = 0
    gstin_mismatch_count: int = 0
    total_eligible_itc: float = 0.0
    total_blocked_itc: float = 0.0
    total_ineligible_itc: float = 0.0


class Reconciliation(Document):
    reconciliation_id: Indexed(str, unique=True)
    user_id: Indexed(str)
    period: str
    financial_year: str
    status: str = "PENDING"  # PENDING, PROCESSING, COMPLETED, FAILED
    results: List[ReconciliationResult] = Field(default_factory=list)
    summary: ReconciliationSummary = Field(default_factory=ReconciliationSummary)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "reconciliations"
