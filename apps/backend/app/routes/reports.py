from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse
from app.models.reconciliation import Reconciliation
from app.services import report_service

router = APIRouter()

@router.get("/reports/{reconciliation_id}/reconciliation")
async def download_reconciliation_report(reconciliation_id: str, format: str = Query("xlsx")):
    reconciliation = await Reconciliation.find_one(Reconciliation.reconciliation_id == reconciliation_id)
    if not reconciliation:
        return JSONResponse(status_code=404, content={"error": "Not found"})

    if format.lower() == "xlsx":
        excel_buffer = await report_service.generate_reconciliation_excel(reconciliation)
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=recon_{reconciliation_id}.xlsx"}
        )
    return JSONResponse(status_code=400, content={"error": "Use ?format=xlsx"})

@router.get("/reports/{reconciliation_id}/gst-summary")
async def get_gst_summary(reconciliation_id: str, format: str = Query("json")):
    reconciliation = await Reconciliation.find_one(Reconciliation.reconciliation_id == reconciliation_id)
    if not reconciliation:
        return JSONResponse(status_code=404, content={"error": "Not found"})

    data = await report_service.generate_gst_summary_json(reconciliation)
    return JSONResponse(content={"success": True, "data": data})
