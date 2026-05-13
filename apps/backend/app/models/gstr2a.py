"""GSTR-2A record document model"""

from datetime import datetime, timezone
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

    # ── Two distinct invoice number fields ───────────────────────────────────
    # vch_no         = internal Tally voucher number  (e.g. "2513")
    #                  mapped from the "Vch No." column
    # invoice_number = official supplier invoice number (e.g. "02103")
    #                  mapped from the "invoice_number" / "Invoice No." column
    #
    # When the Excel has both columns, both are stored separately.
    # When only one column exists (older Tally exports), invoice_number
    # falls back to the same value as vch_no so matching still works.
    vch_no: str = ""
    invoice_number: str = ""          # ← NEW — official supplier invoice number

    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst_utgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0
    invoice_amount: float = 0.0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "gstr2a_records"
        indexes = [
            [("user_id", 1), ("period_start", 1), ("period_end", 1)],
            [("user_id", 1), ("party_gstin", 1)],
        ]