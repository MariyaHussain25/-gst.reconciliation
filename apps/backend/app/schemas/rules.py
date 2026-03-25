"""Pydantic schemas for ITC Rules API — Phase 6"""

from typing import List, Optional
from pydantic import BaseModel


class RuleSearchRequest(BaseModel):
    query: str
    top_k: int = 3


class RuleResponse(BaseModel):
    rule_id: str
    category: str
    title: str
    description: str
    keywords: List[str]
    gst_section: Optional[str]
    gstr3b_table: Optional[str]
    is_active: bool


class RuleSearchResponse(BaseModel):
    success: bool
    rules: List[RuleResponse]
    search_method: str  # "embedding" or "keyword"
