"""Returns Summary route — per-period filing status and record counts."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_current_user_id
from app.models.invoice import Invoice
from app.models.reconciliation import Reconciliation

router = APIRouter()

# Static metadata for each return type
_RETURN_META = {
    "GSTR-1": {
        "description": "Details of outward supplies of goods or services or both",
        "frequency": "Monthly",
    },
    "GSTR-2A": {
        "description": "Auto drafted details of inward supplies (view only)",
        "frequency": "Auto-generated",
    },
    "GSTR-2B": {
        "description": "Auto-drafted ITC Statement (view only)",
        "frequency": "Auto-generated",
    },
    "GSTR-3B": {
        "description": "Monthly return — summary of outward, inward supplies and tax liability",
        "frequency": "Monthly",
    },
}


@router.get("/returns-summary/{user_id}")
async def get_returns_summary(
    user_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    period: str = Query(..., description="Period in YYYY-MM format"),
) -> JSONResponse:
    """
    Return filing status and record counts for GSTR-1, GSTR-2A, GSTR-2B, GSTR-3B
    for a given user and period.

    Status logic:
      - GSTR-1:  'Filed' if BOOKS invoices exist, else 'Not Filed'
      - GSTR-2A: always null (auto-generated); record_count shows uploaded rows
      - GSTR-2B: always null (auto-generated); record_count shows uploaded rows
      - GSTR-3B: 'Filed' if a COMPLETED reconciliation exists for the period,
                 'To be Filed' if an in-progress/pending one exists, else null
    """
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Count invoices per source in parallel queries
    books_count, gstr2a_count, gstr2b_count = await _count_sources(user_id, period)

    # Latest reconciliation for this period
    recon = await (
        Reconciliation.find(
            Reconciliation.user_id == user_id,
            Reconciliation.period == period,
        )
        .sort(-Reconciliation.created_at)
        .first_or_none()
    )

    gstr3b_status: str | None = None
    recon_id: str | None = None
    if recon:
        recon_id = recon.reconciliation_id
        gstr3b_status = "Filed" if recon.status == "COMPLETED" else "To be Filed"

    returns = [
        {
            **_RETURN_META["GSTR-1"],
            "type": "GSTR-1",
            "status": "Filed" if books_count > 0 else "Not Filed",
            "record_count": books_count,
            "detail_href": "#",
        },
        {
            **_RETURN_META["GSTR-2A"],
            "type": "GSTR-2A",
            "status": None,
            "record_count": gstr2a_count,
            "detail_href": "/gstr2a",
        },
        {
            **_RETURN_META["GSTR-2B"],
            "type": "GSTR-2B",
            "status": None,
            "record_count": gstr2b_count,
            "detail_href": "#",
        },
        {
            **_RETURN_META["GSTR-3B"],
            "type": "GSTR-3B",
            "status": gstr3b_status,
            "record_count": None,
            "reconciliation_id": recon_id,
            "detail_href": f"/results/{recon_id}" if recon_id else "#",
        },
    ]

    return JSONResponse(content={"success": True, "period": period, "returns": returns})


async def _count_sources(user_id: str, period: str) -> tuple[int, int, int]:
    """Count BOOKS, GSTR_2A, GSTR_2B invoice rows for the given period."""
    books = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "BOOKS",
    ).count()
    gstr2a = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2A",
    ).count()
    gstr2b = await Invoice.find(
        Invoice.user_id == user_id,
        Invoice.period == period,
        Invoice.source == "GSTR_2B",
    ).count()
    return books, gstr2a, gstr2b
