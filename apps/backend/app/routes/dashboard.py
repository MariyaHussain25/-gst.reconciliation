"""Dashboard route — aggregated statistics for the frontend dashboard."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_current_user_id
from app.models.reconciliation import Reconciliation

router = APIRouter()


@router.get("/dashboard/{user_id}")
async def get_dashboard_summary(
    user_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Return dashboard stats and recent reconciliation data for a user."""
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Most recent completed reconciliation — used for stats + supplier results
    latest = await (
        Reconciliation.find(
            Reconciliation.user_id == user_id,
            Reconciliation.status == "COMPLETED",
        )
        .sort(-Reconciliation.created_at)
        .first_or_none()
    )

    # Last 5 reconciliation runs of any status — used for the runs table
    recent_runs_docs = await (
        Reconciliation.find(Reconciliation.user_id == user_id)
        .sort(-Reconciliation.created_at)
        .limit(5)
        .to_list()
    )

    stats = {
        "total_invoices": 0,
        "matched_count": 0,
        "needs_review_count": 0,
        "missing_in_2b_count": 0,
        "total_eligible_itc": 0.0,
    }
    recent_results: list[dict] = []
    financial_year = "—"

    if latest:
        s = latest.summary
        stats = {
            "total_invoices": s.total_invoices,
            "matched_count": s.matched_count,
            "needs_review_count": s.needs_review_count,
            "missing_in_2b_count": s.missing_in_2b_count,
            "total_eligible_itc": round(s.total_eligible_itc, 2),
        }
        financial_year = latest.financial_year

        for r in latest.results[:10]:
            vendor = r.gstr2a_vendor_name or r.gstr2b_vendor_name or "Unknown Vendor"
            recent_results.append(
                {
                    "vendor_name": vendor,
                    "match_status": r.match_status,
                    "period": latest.period,
                }
            )

    recent_runs = [
        {
            "reconciliation_id": doc.reconciliation_id,
            "period": doc.period,
            "financial_year": doc.financial_year,
            "status": doc.status,
            "matched_count": doc.summary.matched_count,
            "total_invoices": doc.summary.total_invoices,
            "created_at": doc.created_at.isoformat(),
        }
        for doc in recent_runs_docs
    ]

    return JSONResponse(
        content={
            "stats": stats,
            "recent_results": recent_results,
            "recent_runs": recent_runs,
            "financial_year": financial_year,
        }
    )
