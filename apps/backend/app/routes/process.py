"""Process route — runs reconciliation pipeline and schedules AI explanations."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_current_user_id
from app.services.process_service import run_reconciliation, enrich_with_ai_explanations
from app.schemas.api import ProcessResponse, ErrorResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/process/{user_id}", response_model=ProcessResponse)
async def process_reconciliation(
    user_id: str,
    background_tasks: BackgroundTasks,                          # ← NEW
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    period: Optional[str] = Query(
        default=None, description="Period in YYYY-MM format"
    ),
):
    """
    Run the reconciliation pipeline and return immediately.

    The 3-pass matching engine runs synchronously so the response is fast.
    AI explanation generation is queued as a background task — it runs after
    the HTTP response is sent, so it never causes a socket hang-up.
    """
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        effective_period = period or ""
        result = await run_reconciliation(user_id, effective_period)

        # Schedule AI explanations to run after this response is sent.
        # enrich_with_ai_explanations never raises — errors are logged internally.
        resolved_period = result.summary.get("period", effective_period)
        background_tasks.add_task(
            enrich_with_ai_explanations, user_id, resolved_period
        )

        return result

    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error=str(e),
                detail="Please verify your input and try again."
            ).model_dump(),
        )
    except Exception as e:
        logger.exception(
            "[process] Reconciliation failed for user=%s period=%s", user_id, period
        )
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="Reconciliation failed",
                detail=str(e),
            ).model_dump(),
        )