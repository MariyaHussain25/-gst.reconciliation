"""Pydantic schemas for PDF generation API responses."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ReconciliationLookupItem(BaseModel):
    reconciliation_id: str
    period: str
    financial_year: str
    status: str
    created_at: datetime
    summary: dict


class ReconciliationLookupResponse(BaseModel):
    success: bool
    user_id: str
    reconciliations: list[ReconciliationLookupItem]


class GeneratePdfJobResponse(BaseModel):
    success: bool
    job_id: str
    reconciliation_id: str
    message: str  # "PDF generation started"
    poll_url: str  # e.g. "/api/reports/{job_id}/status"


class PdfJobStatusResponse(BaseModel):
    success: bool
    job_id: str
    status: str               # PENDING | PROCESSING | COMPLETED | FAILED
    error_message: Optional[str] = None
    download_url: Optional[str] = None   # present only when COMPLETED
