"""GST Rule document model - replaces rules.model.ts"""

from datetime import datetime
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import Field


class GstRule(Document):
    rule_id: Indexed(str, unique=True)
    category: str  # ITC_ELIGIBILITY, BLOCKED_ITC, RCM, EXEMPT, MATCHING
    title: str
    description: str
    keywords: List[str] = Field(default_factory=list)
    gst_section: Optional[str] = None
    gstr3b_table: Optional[str] = None
    embedding: List[float] = Field(default_factory=list)  # 1536 dimensions for Phase 6
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "gst_rules"
