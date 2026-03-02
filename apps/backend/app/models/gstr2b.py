"""GSTR-2B record document model - replaces gstr2b.model.ts"""

from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field


class Gstr2BRecord(Document):
    # File metadata
    user_id: str
    file_name: str
    financial_year: str = ""
    tax_period: str = ""
    buyer_gstin: str = ""
    legal_name: str = ""
    trade_name: str = ""
    date_of_generation: str = ""
    sheet_name: str = ""

    # B2B Invoice fields (from Excel columns)
    supplier_gstin: str = ""
    supplier_trade_name: str = ""
    invoice_number: str = ""
    invoice_type: str = ""
    invoice_date: str = ""
    invoice_value: float = 0.0
    place_of_supply: str = ""
    supply_attracts_reverse_charge: str = ""
    tax_rate: Optional[float] = None
    taxable_value: float = 0.0
    integrated_tax: float = 0.0
    central_tax: float = 0.0
    state_ut_tax: float = 0.0
    cess: float = 0.0
    gstr1_period: Optional[str] = None
    gstr1_filing_date: Optional[str] = None
    itc_availability: str = ""
    itc_unavailable_reason: Optional[str] = None
    applicable_tax_rate_percent: Optional[float] = None
    source: str = ""
    irn: Optional[str] = None
    irn_date: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "gstr2b_records"
        indexes = [
            [("user_id", 1), ("financial_year", 1), ("tax_period", 1)],
            [("user_id", 1), ("supplier_gstin", 1)],
        ]
