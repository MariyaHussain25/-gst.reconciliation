"""API request/response Pydantic schemas."""

from typing import Optional
from pydantic import BaseModel


class UploadResponse(BaseModel):
    success: bool
    message: str
    file_id: str
    file_name: str
    file_type: str  # "GSTR_2A" or "GSTR_2B"
    records_parsed: int


class ProcessResponse(BaseModel):
    success: bool
    message: str
    summary: dict


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None  # NEVER a stack trace, always user-friendly


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "gst-reconciliation-backend"
    version: str
