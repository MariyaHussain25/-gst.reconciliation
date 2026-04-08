"""Upload route - rewrite of upload.route.ts"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.auth.dependencies import get_current_user_id
from app.services.upload_service import handle_upload
from app.schemas.api import UploadResponse, ErrorResponse

router = APIRouter()


@router.post("/upload-docs", response_model=UploadResponse)
async def upload_docs(
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a GSTR-2A or GSTR-2B Excel file."""
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        file_bytes = await file.read()
        result = await handle_upload(file_bytes, file.filename or "upload.xlsx", user_id)
        return result
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error=str(e), detail="Please check your file and try again.").model_dump(),
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="Upload failed", detail="An error occurred while processing your file.").model_dump(),
        )
