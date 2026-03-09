"""
Async PDF job queue service.

Manages lifecycle of PdfJob documents:
  PENDING → PROCESSING → COMPLETED | FAILED
"""

from datetime import datetime, timezone
from fastapi import HTTPException
import uuid

from app.models.pdf_job import PdfJob
from app.models.reconciliation import Reconciliation
from app.services import pdf_service


async def create_job(reconciliation_id: str, user_id: str) -> PdfJob:
    """Create and persist a new PENDING job."""
    job = PdfJob(
        job_id=str(uuid.uuid4()),
        user_id=user_id,
        reconciliation_id=reconciliation_id,
        status="PENDING",
    )
    await job.insert()
    return job


async def run_job(job_id: str) -> None:
    """
    Fetch job, set status=PROCESSING, generate PDF, store bytes, set status=COMPLETED.
    On exception: set status=FAILED, store error_message.
    """
    job = await PdfJob.find_one(PdfJob.job_id == job_id)
    if job is None:
        return

    try:
        job.status = "PROCESSING"
        await job.save()

        reconciliation = await Reconciliation.find_one(
            Reconciliation.reconciliation_id == job.reconciliation_id
        )
        if reconciliation is None:
            raise ValueError(
                f"Reconciliation '{job.reconciliation_id}' not found"
            )

        pdf_bytes = pdf_service.generate_pdf(reconciliation)

        job.pdf_bytes = pdf_bytes
        job.status = "COMPLETED"
        job.completed_at = datetime.now(timezone.utc)
        await job.save()

    except Exception as exc:  # noqa: BLE001 — catch-all intentional: mark job FAILED for any error
        job.status = "FAILED"
        job.error_message = str(exc)
        job.completed_at = datetime.now(timezone.utc)
        await job.save()


async def get_job(job_id: str, user_id: str) -> PdfJob:
    """Fetch job; return 404 if not found; 403 if user_id mismatch."""
    job = await PdfJob.find_one(PdfJob.job_id == job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return job
