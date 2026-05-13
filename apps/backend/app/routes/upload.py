from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.auth.dependencies import get_current_user_id
from app.services.upload_service import handle_upload
from app.schemas.api import UploadResponse, ErrorResponse
import logging

# Set up logging
logger = logging.getLogger(__name__)
router = APIRouter()

# Define allowed file extensions
ALLOWED_EXTENSIONS = {"xls", "xlsx"}

def allowed_file(filename: str) -> bool:
    """Check if the uploaded file is an allowed type."""
    return filename.lower().endswith(tuple(ALLOWED_EXTENSIONS))

@router.post("/upload-docs", response_model=UploadResponse)
async def upload_docs(
    current_user_id: Annotated[str, Depends(get_current_user_id)],
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a GSTR-2A or GSTR-2B Excel file."""
    
    # Check if the user has permission to upload
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check file extension
    if not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .xls and .xlsx files are allowed.")
    
    try:
        # Read the file bytes
        file_bytes = await file.read()
        
        # Handle the file upload
        result = await handle_upload(file_bytes, file.filename or "upload.xlsx", user_id)
        
        # Return the result from the service
        return result

    except ValueError as e:
        # Handle known errors like file format issues
        logger.error(f"ValueError during file upload: {e}")
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error=str(e), detail="Please check your file and try again.").model_dump(),
        )
    except Exception as e:
        # Catch all other exceptions and log them
        logger.error(f"Unexpected error during file upload: {e}")
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="Upload failed", detail="An error occurred while processing your file.").model_dump(),
        )
