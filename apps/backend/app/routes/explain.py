"""AI Explanation API routes — Phase 7"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_current_user_id, verify_reconciliation_ownership
from app.schemas.explain import ExplainResponse, ExplainResultItem, ExplainResultsResponse
from app.services import ai_explanation_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/explain/{reconciliation_id}", response_model=ExplainResponse)
async def generate_explanations(
    reconciliation_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Trigger AI explanation generation for all results in a reconciliation."""
    try:
        reconciliation = await verify_reconciliation_ownership(reconciliation_id, current_user_id)

        explanations, ai_enriched_count = await ai_explanation_service.generate_explanations_for_reconciliation(
            reconciliation
        )

        for i, result in enumerate(reconciliation.results):
            result.ai_explanation = explanations[i]

        await reconciliation.save()

        return ExplainResponse(
            success=True,
            reconciliation_id=reconciliation_id,
            results_explained=len(explanations),
            message=(
                f"Generated explanations for {len(explanations)} result(s). "
                f"OpenRouter enriched {ai_enriched_count} result(s); the remainder used deterministic summaries."
            ),
        )

    except Exception as exc:  # pylint: disable=broad-except
        logger.error("[explain] Unexpected error for %s: %s", reconciliation_id, exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Internal server error", "detail": None},
        )


@router.get("/explain/{reconciliation_id}", response_model=ExplainResultsResponse)
async def get_explanations(
    reconciliation_id: str,
    current_user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Fetch a reconciliation with its AI explanations."""
    reconciliation = await verify_reconciliation_ownership(reconciliation_id, current_user_id)

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
