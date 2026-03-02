"""Process route - rewrite of process.route.ts"""

from typing import Optional
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from app.services.process_service import run_reconciliation
from app.schemas.api import ProcessResponse, ErrorResponse

router = APIRouter()


@router.post("/process/{user_id}", response_model=ProcessResponse)
async def process_reconciliation(
    user_id: str,
    period: Optional[str] = Query(default=None, description="Period in YYYY-MM format"),
):
    """Run the reconciliation pipeline for a user and optional period."""
    try:
        effective_period = period or ""
        result = await run_reconciliation(user_id, effective_period)
        return result
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error=str(e), detail="Please verify your input and try again.").model_dump(),
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="Reconciliation failed", detail="An error occurred during reconciliation.").model_dump(),
        )
