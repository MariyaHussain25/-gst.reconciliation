"""
PDF generation routes — Phase 8.

Endpoints:
  GET  /generate-pdf/{reconciliation_id}          — sync download (fast path)
  POST /generate-pdf                              — async job submission
  GET  /reports/{job_id}/status                   — job status polling
  GET  /reports/{job_id}/download                 — download completed PDF
  GET  /generate-pdf/by-user/{user_id}/lookup     — metadata lookup
  GET  /generate-pdf/by-user/{user_id}            — convenience download
"""

import asyncio
import io
from beanie.operators import In

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.auth.dependencies import get_current_user_id, verify_reconciliation_ownership
from app.models.reconciliation import Reconciliation
from app.schemas.pdf import (
    GeneratePdfJobResponse,
    PdfJobStatusResponse,
    ReconciliationLookupItem,
    ReconciliationLookupResponse,
)
from app.services import pdf_job_service
from app.services import pdf_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Helper — parse duration query params into a list of YYYY-MM period strings
# ---------------------------------------------------------------------------

_FY_MONTHS: dict[str, list[str]] = {
    "Q1": ["04", "05", "06"],
    "Q2": ["07", "08", "09"],
    "Q3": ["10", "11", "12"],
    "Q4": ["01", "02", "03"],
}


def _fy_to_periods(financial_year: str, quarter: Optional[str] = None) -> list[str]:
    """
    Convert a financial year string (e.g. "2024-25") and optional quarter
    ("Q1"–"Q4" or "Full Year") to a list of YYYY-MM period strings.
    """
    try:
        start_year = int(financial_year.split("-")[0])
    except (ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Invalid duration format",
                "detail": f"financial_year must be in YYYY-YY format, got '{financial_year}'",
            },
        ) from exc

    if quarter and quarter.upper() != "FULL YEAR":
        q = quarter.upper()
        if q not in _FY_MONTHS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid quarter '{quarter}'. Expected Q1, Q2, Q3, Q4, or omit.",
            )
        months = _FY_MONTHS[q]
        year = start_year + 1 if q == "Q4" else start_year
        return [f"{year}-{m}" for m in months]

    # Full year: Apr–Mar
    periods = [f"{start_year}-{m:02d}" for m in range(4, 13)]
    periods += [f"{start_year + 1}-{m:02d}" for m in range(1, 4)]
    return periods


def _date_range_to_periods(date_range: str) -> list[str]:
    """
    Convert "YYYY-MM_to_YYYY-MM" to a list of YYYY-MM period strings (inclusive).
    """
    try:
        start_str, end_str = date_range.split("_to_")
        sy, sm = start_str.split("-")
        ey, em = end_str.split("-")
        start_year, start_month = int(sy), int(sm)
        end_year, end_month = int(ey), int(em)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date_range format '{date_range}'. Expected YYYY-MM_to_YYYY-MM.",
        ) from exc

    periods: list[str] = []
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        periods.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return periods


def _resolve_periods(
    financial_year: Optional[str],
    quarter: Optional[str],
    date_range: Optional[str],
) -> Optional[list[str]]:
    """Return a list of periods to filter by, or None for 'no filter'."""
    if date_range:
        return _date_range_to_periods(date_range)
    if financial_year:
        return _fy_to_periods(financial_year, quarter)
    return None


# ---------------------------------------------------------------------------
# Request body schema
# ---------------------------------------------------------------------------

class GeneratePdfRequest(BaseModel):
    reconciliation_id: str


# ---------------------------------------------------------------------------
# 6.5 — Metadata lookup  (must be declared BEFORE /{reconciliation_id} to
#        avoid route shadowing for the literal path segment "by-user")
# ---------------------------------------------------------------------------

@router.get("/generate-pdf/by-user/{user_id}/lookup", response_model=ReconciliationLookupResponse)
async def lookup_reconciliations(
    user_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    financial_year: Optional[str] = Query(default=None),
    quarter: Optional[str] = Query(default=None),
    date_range: Optional[str] = Query(default=None),
):
    """Return metadata for all matching reconciliations (no PDF bytes)."""
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    periods = _resolve_periods(financial_year, quarter, date_range)
    filters = [Reconciliation.user_id == user_id]
    if periods:
        filters.append(In(Reconciliation.period, periods))
    docs = await Reconciliation.find(*filters).to_list()

    items = [
        ReconciliationLookupItem(
            reconciliation_id=doc.reconciliation_id,
            period=doc.period,
            financial_year=doc.financial_year,
            status=doc.status,
            created_at=doc.created_at,
            summary=doc.summary.model_dump(),
        )
        for doc in docs
    ]

    return ReconciliationLookupResponse(
        success=True,
        user_id=user_id,
        reconciliations=items,
    )


# ---------------------------------------------------------------------------
# 6.6 — Convenience download by user + duration
# ---------------------------------------------------------------------------

@router.get("/generate-pdf/by-user/{user_id}")
async def download_pdf_by_user(
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    financial_year: Optional[str] = Query(default=None),
    quarter: Optional[str] = Query(default=None),
    date_range: Optional[str] = Query(default=None),
):
    """Pick the most recently created matching reconciliation and return its PDF."""
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    periods = _resolve_periods(financial_year, quarter, date_range)
    filters = [Reconciliation.user_id == user_id]
    if periods:
        filters.append(In(Reconciliation.period, periods))
    docs = await Reconciliation.find(*filters).to_list()

    if not docs:
        available = await Reconciliation.find(
            Reconciliation.user_id == user_id
        ).to_list()
        available_periods = sorted({d.period for d in available})
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "No reconciliation found",
                "detail": "No reconciliation matches the requested period.",
                "available_periods": available_periods,
            },
        )

    # Pick the most recently created reconciliation
    reconciliation = sorted(docs, key=lambda d: d.created_at, reverse=True)[0]

    if reconciliation.status != "COMPLETED":
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "error": "Reconciliation not yet complete",
                "detail": f"status is '{reconciliation.status}'",
            },
        )

    try:
        pdf_bytes = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, pdf_service.generate_pdf, reconciliation
            ),
            timeout=30,
        )
    except asyncio.TimeoutError:
        job = await pdf_job_service.create_job(reconciliation.reconciliation_id, user_id)
        background_tasks.add_task(pdf_job_service.run_job, job.job_id)
        return JSONResponse(
            status_code=202,
            content=GeneratePdfJobResponse(
                success=True,
                job_id=job.job_id,
                reconciliation_id=reconciliation.reconciliation_id,
                message="PDF generation started",
                poll_url=f"/api/reports/{job.job_id}/status",
            ).model_dump(),
        )

    filename = (
        f"gst_reconciliation_{reconciliation.reconciliation_id}_{reconciliation.period}.pdf"
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# 6.1 — Synchronous download (fast path)
# ---------------------------------------------------------------------------

@router.get("/generate-pdf/{reconciliation_id}")
async def generate_pdf_sync(
    reconciliation_id: str,
    background_tasks: BackgroundTasks,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Synchronously generate and stream a PDF for a completed reconciliation."""
    reconciliation = await verify_reconciliation_ownership(
        reconciliation_id, current_user_id
    )

    if reconciliation.status != "COMPLETED":
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "error": "Reconciliation not yet complete",
                "detail": f"status is '{reconciliation.status}'",
            },
        )

    try:
        pdf_bytes = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, pdf_service.generate_pdf, reconciliation
            ),
            timeout=30,
        )
    except asyncio.TimeoutError:
        job = await pdf_job_service.create_job(reconciliation_id, current_user_id)
        background_tasks.add_task(pdf_job_service.run_job, job.job_id)
        return JSONResponse(
            status_code=202,
            content=GeneratePdfJobResponse(
                success=True,
                job_id=job.job_id,
                reconciliation_id=reconciliation_id,
                message="PDF generation started",
                poll_url=f"/api/reports/{job.job_id}/status",
            ).model_dump(),
        )

    filename = (
        f"gst_reconciliation_{reconciliation_id}_{reconciliation.period}.pdf"
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# 6.2 — Async job submission
# ---------------------------------------------------------------------------

@router.post("/generate-pdf", status_code=202, response_model=GeneratePdfJobResponse)
async def generate_pdf_async(
    body: GeneratePdfRequest,
    background_tasks: BackgroundTasks,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Submit an async PDF generation job and return immediately."""
    await verify_reconciliation_ownership(body.reconciliation_id, current_user_id)

    job = await pdf_job_service.create_job(body.reconciliation_id, current_user_id)
    background_tasks.add_task(pdf_job_service.run_job, job.job_id)

    return GeneratePdfJobResponse(
        success=True,
        job_id=job.job_id,
        reconciliation_id=body.reconciliation_id,
        message="PDF generation started",
        poll_url=f"/api/reports/{job.job_id}/status",
    )


# ---------------------------------------------------------------------------
# 6.3 — Job status
# ---------------------------------------------------------------------------

@router.get("/reports/{job_id}/status", response_model=PdfJobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Poll the status of an async PDF job."""
    job = await pdf_job_service.get_job(job_id, current_user_id)

    download_url: Optional[str] = None
    if job.status == "COMPLETED":
        download_url = f"/api/reports/{job_id}/download"

    return PdfJobStatusResponse(
        success=True,
        job_id=job_id,
        status=job.status,
        error_message=job.error_message,
        download_url=download_url,
    )


# ---------------------------------------------------------------------------
# 6.4 — Download completed job PDF
# ---------------------------------------------------------------------------

@router.get("/reports/{job_id}/download")
async def download_job_pdf(
    job_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Stream the PDF bytes from a completed job."""
    job = await pdf_job_service.get_job(job_id, current_user_id)

    if job.status != "COMPLETED" or job.pdf_bytes is None:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "PDF not ready",
                "detail": f"Job status is '{job.status}'",
            },
        )

    filename = f"gst_reconciliation_{job.reconciliation_id}.pdf"
    return StreamingResponse(
        io.BytesIO(job.pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
