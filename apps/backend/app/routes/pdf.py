"""PDF generation routes — Phase 8."""

import io
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse

from app.models.reconciliation import Reconciliation
from app.schemas.pdf import ReconciliationLookupItem, ReconciliationLookupResponse
from app.services import pdf_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Helper: parse duration query params into a list of YYYY-MM period strings
# ---------------------------------------------------------------------------

def _fy_start_year(financial_year: str) -> int:
    """Return the start calendar year from a financial-year string like '2024-25'."""
    return int(financial_year.split("-")[0])


_QUARTER_MONTHS: dict[str, list[int]] = {
    "Q1": [4, 5, 6],
    "Q2": [7, 8, 9],
    "Q3": [10, 11, 12],
    "Q4": [1, 2, 3],
}


def _periods_for_fy_quarter(financial_year: str, quarter: Optional[str]) -> list[str]:
    """Return YYYY-MM period strings for the given FY and quarter (or full year)."""
    start_year = _fy_start_year(financial_year)
    end_year = start_year + 1

    if quarter and quarter.upper() != "FULL YEAR":
        months = _QUARTER_MONTHS.get(quarter.upper())
        if months is None:
            raise ValueError(f"Invalid quarter '{quarter}'. Use Q1, Q2, Q3, Q4, or Full Year.")
        year_for_month = {
            4: start_year, 5: start_year, 6: start_year,
            7: start_year, 8: start_year, 9: start_year,
            10: start_year, 11: start_year, 12: start_year,
            1: end_year, 2: end_year, 3: end_year,
        }
        return [f"{year_for_month[m]:04d}-{m:02d}" for m in months]

    # Full year: April start_year ... March end_year
    periods: list[str] = []
    for m in range(4, 13):
        periods.append(f"{start_year:04d}-{m:02d}")
    for m in range(1, 4):
        periods.append(f"{end_year:04d}-{m:02d}")
    return periods


def _periods_for_date_range(date_range: str) -> list[str]:
    """Return YYYY-MM period strings for a date_range like '2024-01_to_2024-03'."""
    try:
        start_str, end_str = date_range.split("_to_")
        sy, sm = int(start_str[:4]), int(start_str[5:7])
        ey, em = int(end_str[:4]), int(end_str[5:7])
    except (ValueError, IndexError):
        raise ValueError(
            f"Invalid date_range '{date_range}'. Expected format: YYYY-MM_to_YYYY-MM."
        )

    periods: list[str] = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        periods.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return periods


def _parse_duration(
    financial_year: Optional[str],
    quarter: Optional[str],
    date_range: Optional[str],
) -> list[str]:
    """Parse duration params into a list of YYYY-MM strings, or raise ValueError."""
    if date_range and financial_year:
        raise ValueError("Provide either 'financial_year' or 'date_range', not both.")
    if date_range:
        return _periods_for_date_range(date_range)
    if financial_year:
        return _periods_for_fy_quarter(financial_year, quarter)
    raise ValueError("Provide 'financial_year' or 'date_range' to filter reconciliations.")


# ---------------------------------------------------------------------------
# Primary endpoint: GET /api/generate-pdf/{reconciliation_id}
# ---------------------------------------------------------------------------

@router.get("/generate-pdf/{reconciliation_id}")
async def generate_pdf_by_id(reconciliation_id: str):
    """Generate and stream a PDF for the given reconciliation_id."""
    reconciliation = await Reconciliation.find_one(
        Reconciliation.reconciliation_id == reconciliation_id
    )
    if reconciliation is None:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "Reconciliation not found",
                "detail": f"No reconciliation found for id '{reconciliation_id}'.",
            },
        )

    try:
        pdf_bytes = pdf_service.generate_pdf(reconciliation)
    except RuntimeError as exc:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "PDF generation unavailable", "detail": str(exc)},
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
# Lookup endpoint: GET /api/generate-pdf/by-user/{user_id}/lookup
# ---------------------------------------------------------------------------

@router.get("/generate-pdf/by-user/{user_id}/lookup", response_model=ReconciliationLookupResponse)
async def lookup_reconciliations(user_id: str):
    """Return metadata for all reconciliations belonging to a user."""
    all_recs: list[Reconciliation] = await Reconciliation.find(
        Reconciliation.user_id == user_id
    ).to_list()

    all_recs.sort(key=lambda r: r.created_at, reverse=True)

    items = [
        ReconciliationLookupItem(
            reconciliation_id=r.reconciliation_id,
            period=r.period,
            financial_year=r.financial_year,
            status=r.status,
            created_at=r.created_at,
            summary=r.summary.model_dump(),
        )
        for r in all_recs
    ]

    return ReconciliationLookupResponse(
        success=True,
        user_id=user_id,
        reconciliations=items,
    )


# ---------------------------------------------------------------------------
# Convenience endpoint: GET /api/generate-pdf/by-user/{user_id}
# ---------------------------------------------------------------------------

@router.get("/generate-pdf/by-user/{user_id}")
async def generate_pdf_by_user(
    user_id: str,
    financial_year: Optional[str] = Query(default=None, description="e.g. 2024-25"),
    quarter: Optional[str] = Query(default=None, description="Q1, Q2, Q3, Q4, or Full Year"),
    date_range: Optional[str] = Query(default=None, description="e.g. 2024-01_to_2024-03"),
):
    """Generate a PDF for the most recent reconciliation matching the given duration."""
    try:
        periods = _parse_duration(financial_year, quarter, date_range)
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Invalid duration parameters", "detail": str(exc)},
        )

    all_user_recs: list[Reconciliation] = await Reconciliation.find(
        Reconciliation.user_id == user_id
    ).to_list()

    periods_set = set(periods)
    matching = [r for r in all_user_recs if r.period in periods_set]

    if not matching:
        available = sorted({r.period for r in all_user_recs})
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "No reconciliation found",
                "detail": (
                    f"No reconciliation found for user '{user_id}' and the specified duration. "
                    "Available periods are returned in the details."
                ),
                "available_periods": available,
            },
        )

    # Use the most recently created reconciliation
    matching.sort(key=lambda r: r.created_at, reverse=True)
    reconciliation = matching[0]

    try:
        pdf_bytes = pdf_service.generate_pdf(reconciliation)
    except RuntimeError as exc:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "PDF generation unavailable", "detail": str(exc)},
        )

    filename = (
        f"gst_reconciliation_{reconciliation.reconciliation_id}_{reconciliation.period}.pdf"
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
