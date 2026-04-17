"""
Upload service - rewrite of upload.service.ts
Handles file upload, validation, parsing and storage.
Files are pushed to S3/R2 when credentials are configured; otherwise
metadata is stored in MongoDB only.
"""

import os
import time
from typing import Iterable
from datetime import datetime, timezone
from app.config.settings import settings
from app.parsers.gstr2a_parser import parse_gstr2a
from app.parsers.gstr2b_parser import parse_gstr2b
from app.models.gstr2a import Gstr2ARecord
from app.models.gstr2b import Gstr2BRecord
from app.models.user import User, Gstr2AFileRef, Gstr2BFileRef
from app.schemas.api import UploadResponse
from app.services import s3_service
from app.utils.date_helpers import parse_gst_date, to_period


ALLOWED_EXTENSIONS = {".xlsx", ".xls"}

MONTH_NAME_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}


def _gstr2b_period_to_yyyy_mm(tax_period: str, financial_year: str) -> str:
    """Convert GSTR-2B tax period metadata into YYYY-MM."""
    if not tax_period or not financial_year:
        return ""

    month_num = MONTH_NAME_MAP.get(tax_period.strip().lower())
    if not month_num:
        return ""

    try:
        start_year = int(financial_year.strip().split("-")[0])
    except (ValueError, IndexError):
        return ""

    year = start_year if month_num >= 4 else start_year + 1
    return f"{year}-{month_num:02d}"


def _safe_period_from_date(date_str: str) -> str:
    """Best-effort date to YYYY-MM conversion."""
    if not date_str:
        return ""
    try:
        return to_period(parse_gst_date(date_str))
    except (ValueError, TypeError):
        return ""


def _collect_non_empty(values: Iterable[str]) -> set[str]:
    return {value for value in values if value}


async def _delete_existing_gstr2a_records(user_id: str, period_start: str, period_end: str, invoice_dates: list[str]) -> None:
    """Replace existing raw GSTR-2A rows for the same user and period."""
    if period_start or period_end:
        await Gstr2ARecord.find(
            Gstr2ARecord.user_id == user_id,
            Gstr2ARecord.period_start == period_start,
            Gstr2ARecord.period_end == period_end,
        ).delete()
        return

    target_periods = _collect_non_empty(_safe_period_from_date(date_str) for date_str in invoice_dates)
    if not target_periods:
        return

    existing = await Gstr2ARecord.find(Gstr2ARecord.user_id == user_id).to_list()
    for record in existing:
        if _safe_period_from_date(record.date) in target_periods:
            await record.delete()


async def _delete_existing_gstr2b_records(user_id: str, financial_year: str, tax_period: str, invoice_dates: list[str]) -> None:
    """Replace existing raw GSTR-2B rows for the same user and period."""
    if financial_year or tax_period:
        await Gstr2BRecord.find(
            Gstr2BRecord.user_id == user_id,
            Gstr2BRecord.financial_year == financial_year,
            Gstr2BRecord.tax_period == tax_period,
        ).delete()
        return

    target_periods = _collect_non_empty(_safe_period_from_date(date_str) for date_str in invoice_dates)
    if not target_periods:
        return

    existing = await Gstr2BRecord.find(Gstr2BRecord.user_id == user_id).to_list()
    for record in existing:
        period = _gstr2b_period_to_yyyy_mm(record.tax_period, record.financial_year) or _safe_period_from_date(record.invoice_date)
        if period in target_periods:
            await record.delete()


async def _replace_gstr2a_file_ref(user_id: str, file_ref: Gstr2AFileRef) -> None:
    """Keep one GSTR-2A file reference per file/period for the user."""
    user = await User.find_one(User.user_id == user_id)
    if user is None:
        return

    user.gstr2a_files = [
        ref
        for ref in user.gstr2a_files
        if ref.period != file_ref.period and ref.file_name != file_ref.file_name
    ]
    user.gstr2a_files.append(file_ref)
    user.updated_at = datetime.now(timezone.utc)
    await user.save()


async def _replace_gstr2b_file_ref(user_id: str, file_ref: Gstr2BFileRef) -> None:
    """Keep one GSTR-2B file reference per file/period for the user."""
    user = await User.find_one(User.user_id == user_id)
    if user is None:
        return

    user.gstr2b_files = [
        ref
        for ref in user.gstr2b_files
        if not (
            ref.file_name == file_ref.file_name
            or (ref.tax_period == file_ref.tax_period and ref.financial_year == file_ref.financial_year)
        )
    ]
    user.gstr2b_files.append(file_ref)
    user.updated_at = datetime.now(timezone.utc)
    await user.save()


def _detect_file_type(file_bytes: bytes) -> str:
    """Detect whether file is GSTR-2A or GSTR-2B by scanning first sheet."""
    from io import BytesIO
    import openpyxl
    try:
        wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
        try:
            # Check for GSTR-2B by looking for "Read me" sheet (government JSON export)
            sheet_names_lower = [s.lower().strip() for s in wb.sheetnames]
            if "read me" in sheet_names_lower:
                return "GSTR_2B"
            # Check first sheet for GSTR-2B / GSTR-2A indicators in cell content
            ws = wb.worksheets[0]
            for row in ws.iter_rows(max_row=10, values_only=True):
                for cell in row:
                    if cell and isinstance(cell, str):
                        cell_upper = cell.upper()
                        if "GSTR-2B" in cell_upper:
                            return "GSTR_2B"
                        if "GSTR-2A" in cell_upper or "VOUCHER REGISTER" in cell_upper:
                            return "GSTR_2A"
            return "GSTR_2A"  # default
        finally:
            wb.close()
    except Exception:
        return "GSTR_2A"


async def handle_upload(file_bytes: bytes, file_name: str, user_id: str) -> UploadResponse:
    """Handle file upload: validate, detect type, parse, and store."""
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Invalid file type '{ext}'. Only .xlsx and .xls are allowed.")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ValueError(f"File size exceeds maximum of {settings.MAX_UPLOAD_SIZE_MB}MB.")

    file_type = _detect_file_type(file_bytes)
    file_id = f"{file_type.lower()}_{user_id}_{int(time.time())}"

    # Push raw file to S3 / R2 (no-op when credentials are absent)
    s3_key = f"gstr_uploads/{user_id}/{file_id}{os.path.splitext(file_name)[1].lower()}"
    s3_service.upload_file(file_bytes, s3_key)

    if file_type == "GSTR_2A":
        result = parse_gstr2a(file_bytes, file_name)
        await _delete_existing_gstr2a_records(
            user_id=user_id,
            period_start=result.metadata.period_start,
            period_end=result.metadata.period_end,
            invoice_dates=[invoice.date for invoice in result.invoices],
        )
        records = [
            Gstr2ARecord(
                user_id=user_id,
                file_name=file_name,
                period_start=result.metadata.period_start,
                period_end=result.metadata.period_end,
                company_name=result.metadata.company_name,
                gstin=result.metadata.gstin,
                date=inv.date,
                particulars=inv.particulars,
                party_gstin=inv.party_gstin,
                vch_type=inv.vch_type,
                vch_no=inv.vch_no,
                taxable_amount=round(inv.taxable_amount, 2),
                igst=round(inv.igst, 2),
                cgst=round(inv.cgst, 2),
                sgst_utgst=round(inv.sgst_utgst, 2),
                cess=round(inv.cess, 2),
                tax_amount=round(inv.tax_amount, 2),
                invoice_amount=round(inv.invoice_amount, 2),
            )
            for inv in result.invoices
        ]
        if records:
            await Gstr2ARecord.insert_many(records)

        # Update user file reference
        file_ref = Gstr2AFileRef(
            file_id=file_id,
            file_name=file_name,
            period=f"{result.metadata.period_start} to {result.metadata.period_end}",
            uploaded_at=datetime.now(timezone.utc),
        )
        await _replace_gstr2a_file_ref(user_id, file_ref)

        return UploadResponse(
            success=True,
            message="GSTR-2A file uploaded and parsed successfully.",
            file_id=file_id,
            file_name=file_name,
            file_type="GSTR_2A",
            records_parsed=len(records),
        )

    else:  # GSTR_2B
        result = parse_gstr2b(file_bytes, file_name)
        await _delete_existing_gstr2b_records(
            user_id=user_id,
            financial_year=result.metadata.financial_year,
            tax_period=result.metadata.tax_period,
            invoice_dates=[invoice.invoice_date for invoice in result.b2b_invoices],
        )
        records = [
            Gstr2BRecord(
                user_id=user_id,
                file_name=file_name,
                financial_year=result.metadata.financial_year,
                tax_period=result.metadata.tax_period,
                buyer_gstin=result.metadata.buyer_gstin,
                legal_name=result.metadata.legal_name,
                trade_name=result.metadata.trade_name,
                date_of_generation=result.metadata.date_of_generation,
                sheet_name=inv.sheet_name,
                supplier_gstin=inv.supplier_gstin,
                supplier_trade_name=inv.supplier_trade_name,
                invoice_number=inv.invoice_number,
                invoice_type=inv.invoice_type,
                invoice_date=inv.invoice_date,
                invoice_value=round(inv.invoice_value, 2),
                place_of_supply=inv.place_of_supply,
                supply_attracts_reverse_charge=inv.supply_attracts_reverse_charge,
                tax_rate=inv.tax_rate,
                taxable_value=round(inv.taxable_value, 2),
                integrated_tax=round(inv.integrated_tax, 2),
                central_tax=round(inv.central_tax, 2),
                state_ut_tax=round(inv.state_ut_tax, 2),
                cess=round(inv.cess, 2),
                gstr1_period=inv.gstr1_period,
                gstr1_filing_date=inv.gstr1_filing_date,
                itc_availability=inv.itc_availability,
                itc_unavailable_reason=inv.itc_unavailable_reason,
                applicable_tax_rate_percent=inv.applicable_tax_rate_percent,
                source=inv.source,
                irn=inv.irn,
                irn_date=inv.irn_date,
            )
            for inv in result.b2b_invoices
        ]
        if records:
            await Gstr2BRecord.insert_many(records)

        # Update user file reference
        file_ref = Gstr2BFileRef(
            file_id=file_id,
            file_name=file_name,
            tax_period=result.metadata.tax_period,
            financial_year=result.metadata.financial_year,
            uploaded_at=datetime.now(timezone.utc),
        )
        await _replace_gstr2b_file_ref(user_id, file_ref)

        return UploadResponse(
            success=True,
            message="GSTR-2B file uploaded and parsed successfully.",
            file_id=file_id,
            file_name=file_name,
            file_type="GSTR_2B",
            records_parsed=len(records),
        )
