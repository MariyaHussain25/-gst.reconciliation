"""AI Explanation API routes — Phase 7"""

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.reconciliation import Reconciliation
from app.schemas.explain import ExplainResponse, ExplainResultItem, ExplainResultsResponse
from app.services import ai_explanation_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/explain/{reconciliation_id}", response_model=ExplainResponse)
async def generate_explanations(reconciliation_id: str):
    """Trigger AI explanation generation for all results in a reconciliation."""
    try:
        reconciliation = await Reconciliation.find_one(
            Reconciliation.reconciliation_id == reconciliation_id
        )
        if reconciliation is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": f"Reconciliation '{reconciliation_id}' not found.",
                },
            )

        explanations = await ai_explanation_service.generate_explanations_for_reconciliation(
            reconciliation
        )

        for i, result in enumerate(reconciliation.results):
            result.ai_explanation = explanations[i]

        await reconciliation.save()

        return ExplainResponse(
            success=True,
            reconciliation_id=reconciliation_id,
            results_explained=len(explanations),
            message=f"Generated AI explanations for {len(explanations)} result(s).",
        )

    except Exception as exc:  # pylint: disable=broad-except
        logger.error("[explain] Unexpected error for %s: %s", reconciliation_id, exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Internal server error", "detail": None},
        )


@router.get("/explain/{reconciliation_id}", response_model=ExplainResultsResponse)
async def get_explanations(reconciliation_id: str):
    """Fetch a reconciliation with its AI explanations."""
    reconciliation = await Reconciliation.find_one(
        Reconciliation.reconciliation_id == reconciliation_id
    )
    if reconciliation is None:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": f"Reconciliation '{reconciliation_id}' not found.",
            },
        )

    result_items = [
        ExplainResultItem(
            index=i,
            match_status=r.match_status,
            gstr2a_vendor_name=r.gstr2a_vendor_name,
            gstr2b_vendor_name=r.gstr2b_vendor_name,
            gstr2b_invoice_number=r.gstr2b_invoice_number,
            total_amount_diff=r.total_amount_diff,
            itc_category=r.itc_category,
            ai_explanation=r.ai_explanation,
        )
        for i, r in enumerate(reconciliation.results)
    ]

    return ExplainResultsResponse(
        success=True,
        reconciliation_id=reconciliation_id,
        period=reconciliation.period,
        status=reconciliation.status,
        total_results=len(reconciliation.results),
        results=result_items,
    )
