"""GST Rule document model - replaces rules.model.ts"""

from datetime import datetime, timezone
from beanie import Document, Indexed
from pydantic import Field


class GstRule(Document):
    rule_id: Indexed(str, unique=True)
    category: str  # ITC_ELIGIBILITY, BLOCKED_ITC, RCM, EXEMPT, MATCHING
    title: str
    description: str
    keywords: list[str] = Field(default_factory=list)
    gst_section: str | None = None
    gstr3b_table: str | None = None
    embedding: list[float] = Field(default_factory=list)  # retained for backward compatibility; unused by keyword search
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "gst_rules"
