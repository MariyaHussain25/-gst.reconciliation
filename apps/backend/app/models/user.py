"""User document model - replaces user.model.ts"""

from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import BaseModel, EmailStr, Field


class Gstr2AFileRef(BaseModel):
    file_id: str
    file_name: str
    period: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Gstr2BFileRef(BaseModel):
    file_id: str
    file_name: str
    tax_period: str
    financial_year: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReconciliationRef(BaseModel):
    reconciliation_id: str
    period: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(Document):
    user_id: Indexed(str, unique=True)
    email: Indexed(str, unique=True)
    hashed_password: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    gstr2a_files: list[Gstr2AFileRef] = Field(default_factory=list)
    gstr2b_files: list[Gstr2BFileRef] = Field(default_factory=list)
    reconciliations: list[ReconciliationRef] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
        indexes = [
            [("user_id", 1)],
        ]
