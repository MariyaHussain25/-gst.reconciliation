"""GSTR-2A record document model - replaces gstr2a.model.ts"""

from datetime import datetime
from beanie import Document
from pydantic import Field


class Gstr2ARecord(Document):
    # File metadata
    user_id: str
    file_name: str
    period_start: str = ""
    period_end: str = ""
    company_name: str = ""
    gstin: str = ""

    # Invoice fields (from Excel columns)
    date: str = ""
    particulars: str = ""
    party_gstin: str = ""
    vch_type: str = ""
    vch_no: str = ""
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst_utgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0
    invoice_amount: float = 0.0

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "gstr2a_records"
        indexes = [
            [("user_id", 1), ("period_start", 1), ("period_end", 1)],
            [("user_id", 1), ("party_gstin", 1)],
        ]
