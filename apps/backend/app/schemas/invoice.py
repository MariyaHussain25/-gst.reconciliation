"""Invoice Pydantic schemas for API operations."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class InvoiceBase(BaseModel):
    gstin: str
    vendor_name: str
    invoice_number: str
    invoice_date: datetime
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    total_amount: float = 0.0


class InvoiceResponse(InvoiceBase):
    match_status: str = "UNMATCHED"
    match_confidence: float = 0.0
    is_duplicate: bool = False
    duplicate_status: Optional[str] = None
