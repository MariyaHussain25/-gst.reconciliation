"""Invoice document model - replaces invoice.model.ts with NEW duplicate tracking fields"""

from datetime import datetime
from typing import Literal, Optional
from beanie import Document, Indexed
from pydantic import Field


class Invoice(Document):
    user_id: Indexed(str)
    source: Literal["BOOKS", "GSTR_2A", "GSTR_2B"]
    gstin: str
    vendor_name: str
    normalized_vendor_name: str = ""
    invoice_number: str
    normalized_invoice_number: str = ""
    invoice_date: datetime
    period: str  # YYYY-MM format
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0  # NEW - was missing in TS model
    total_amount: float = 0.0
    match_status: str = "UNMATCHED"
    match_confidence: float = 0.0
    itc_category: Optional[str] = None
    description: Optional[str] = None

    # NEW duplicate tracking fields
    is_duplicate: bool = False
    duplicate_group_id: Optional[str] = None
    duplicate_of: Optional[str] = None  # ObjectId reference to primary invoice as string
    duplicate_status: Optional[str] = None  # FLAGGED, CONFIRMED, DISMISSED
    duplicate_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "invoices"
        indexes = [
            [("user_id", 1), ("period", 1)],
            [("user_id", 1), ("period", 1), ("source", 1)],
            [("user_id", 1), ("period", 1), ("gstin", 1), ("normalized_invoice_number", 1)],
        ]
