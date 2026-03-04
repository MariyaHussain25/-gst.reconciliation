"""Pydantic schemas for ITC Rules API — Phase 6"""

from pydantic import BaseModel


class RuleSearchRequest(BaseModel):
    query: str
    top_k: int = 3


class RuleResponse(BaseModel):
    rule_id: str
    category: str
    title: str
    description: str
    keywords: list[str]
    gst_section: str | None
    gstr3b_table: str | None
    is_active: bool


class RuleSearchResponse(BaseModel):
    success: bool
    rules: list[RuleResponse]
    search_method: str  # "embedding" or "keyword"
