"""PdfJob document model — tracks asynchronous PDF generation jobs."""

from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class PdfJob(Document):
    job_id: Indexed(str, unique=True)   # uuid4
    user_id: Indexed(str)
    reconciliation_id: str
    status: str = "PENDING"             # PENDING | PROCESSING | COMPLETED | FAILED
    error_message: Optional[str] = None
    pdf_bytes: Optional[bytes] = None   # store small PDFs inline; large ones could go to S3
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    class Settings:
        name = "pdf_jobs"
        indexes = [
            [("job_id", 1)],
            [("user_id", 1)],
        ]
