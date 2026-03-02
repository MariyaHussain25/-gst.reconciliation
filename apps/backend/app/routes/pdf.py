"""PDF route - PLACEHOLDER for Phase 8"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/generate-pdf/{user_id}/{duration}")
async def generate_pdf(user_id: str, duration: str):
    # Phase 8: WeasyPrint or ReportLab PDF generation
    return JSONResponse(
        status_code=501,
        content={"success": False, "error": "Not implemented", "detail": "PDF generation will be available in Phase 8."},
    )
