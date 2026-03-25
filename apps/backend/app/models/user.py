"""User document model - replaces user.model.ts"""

from datetime import datetime
from typing import List
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class Gstr2AFileRef(BaseModel):
    file_id: str
    file_name: str
    period: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class Gstr2BFileRef(BaseModel):
    file_id: str
    file_name: str
    tax_period: str
    financial_year: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class ReconciliationRef(BaseModel):
    reconciliation_id: str
    period: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(Document):
    user_id: Indexed(str, unique=True)
    email: str
    gstr2a_files: List[Gstr2AFileRef] = Field(default_factory=list)
    gstr2b_files: List[Gstr2BFileRef] = Field(default_factory=list)
    reconciliations: List[ReconciliationRef] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = [
            [("user_id", 1)],
        ]
