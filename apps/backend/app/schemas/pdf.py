"""Pydantic response schemas for the PDF generation endpoints."""

from datetime import datetime
from pydantic import BaseModel


class ReconciliationLookupItem(BaseModel):
    reconciliation_id: str
    period: str
    financial_year: str
    status: str
    created_at: datetime
    summary: dict  # ReconciliationSummary as dict


class ReconciliationLookupResponse(BaseModel):
    success: bool
    user_id: str
    reconciliations: list[ReconciliationLookupItem]
