"""ITC Rules API routes — Phase 6 RAG Knowledge Base"""

import logging
import uuid

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.models.gst_rule import GstRule
from app.schemas.rules import RuleResponse, RuleSearchRequest, RuleSearchResponse
from app.services import itc_rules_service, vector_service

router = APIRouter()
logger = logging.getLogger(__name__)

# GST-specific keyword terms used for keyword-search fallback extraction.
# Covers common ITC categories, tax types, filing references, and key verbs.
_GST_KEYWORD_PATTERN = (
    r"\b(ITC|IGST|CGST|SGST|GSTR|RCM|exempt|blocked|eligible|invoice|vendor"
    r"|section\s+\d+|rule\s+\d+|taxable|credit|input|output)\b"
)


def _to_response(rule) -> RuleResponse:
    """Convert a rule document to a RuleResponse (omits internal storage fields)."""
    return RuleResponse(
        rule_id=rule.rule_id,
        category=rule.category,
        title=rule.title,
        description=rule.description,
        keywords=rule.keywords,
        gst_section=rule.gst_section,
        gstr3b_table=rule.gstr3b_table,
        is_active=rule.is_active,
    )


@router.get("/rules", response_model=list[RuleResponse])
async def list_rules():
    """Return all active GST rules."""
    rules = await itc_rules_service.get_all_active_rules()
    return [_to_response(r) for r in rules]


@router.get("/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(rule_id: str):
    """Return a single rule by its rule_id."""
    rule = await itc_rules_service.get_rule_by_id(rule_id)
    if rule is None:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": f"Rule '{rule_id}' not found."},
        )
    return _to_response(rule)


@router.post("/rules/search", response_model=RuleSearchResponse)
async def search_rules(body: RuleSearchRequest):
    """Search rules using keyword retrieval over saved or bundled GST rules."""
    rules, method = await itc_rules_service.find_relevant_rules(
        query=body.query,
        top_k=body.top_k,
    )
    return RuleSearchResponse(
        success=True,
        rules=[_to_response(r) for r in rules],
        search_method=method,
    )


@router.post("/rules/upload")
async def upload_gst_rules(
    file: UploadFile = File(...),
    section: str = Form(default=""),
    category: str = Form(default="GENERAL"),
):
    """Ingest a text or PDF file of GST rules into the rules knowledge base.

    Workflow:
      1. Read the uploaded file.
      2. Extract text (plain .txt or PDF).
      3. Chunk the text into overlapping segments.
      4. Persist each chunk as a ``GstRule`` document in MongoDB.
      5. Use keyword matching over those saved rules during chat and explanation requests.

    Args:
        file: The uploaded .txt or .pdf file containing GST rules.
        section: Optional GST section label (e.g. "Section 16", "Rule 36").
        category: ITC rule category tag (default ``"GENERAL"``).

    Returns:
        JSON with ``success``, ``chunks_saved``, and ``message`` fields.
    """
    filename = file.filename or ""
    content_type = (file.content_type or "").lower()

    # Determine file type
    is_pdf = filename.lower().endswith(".pdf") or "pdf" in content_type
    is_text = (
        filename.lower().endswith(".txt")
        or "text/plain" in content_type
        or (not is_pdf)
    )

    if not is_pdf and not is_text:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Only .txt and .pdf files are supported."},
        )

    try:
        file_bytes = await file.read()

        # 1. Extract text
        if is_pdf:
            try:
                raw_text = vector_service.extract_text_from_pdf(file_bytes)
            except RuntimeError:
                logger.warning("[rules/upload] PDF text extraction failed for '%s'.", filename)
                return JSONResponse(
                    status_code=422,
                    content={"success": False, "error": "Failed to extract text from PDF. Ensure the file is a valid, non-encrypted PDF."},
                )
        else:
            raw_text = file_bytes.decode("utf-8", errors="replace")

        if not raw_text.strip():
            return JSONResponse(
                status_code=422,
                content={"success": False, "error": "No readable text found in the uploaded file."},
            )

        # 2. Chunk
        chunks = vector_service.chunk_text(raw_text)
        if not chunks:
            return JSONResponse(
                status_code=422,
                content={"success": False, "error": "Could not split the document into chunks."},
            )

        # 3. Persist each chunk as a GstRule document
        saved = 0
        source_name = filename or "uploaded_document"
        for i, chunk in enumerate(chunks):
            rule = GstRule(
                rule_id=str(uuid.uuid4()),
                category=category.upper() or "GENERAL",
                title=f"{source_name} - chunk {i + 1}",
                description=chunk,
                keywords=_extract_keywords(chunk),
                gst_section=section or None,
                embedding=[],
                is_active=True,
            )
            await rule.insert()
            saved += 1

        logger.info(
            "[rules/upload] Ingested %d chunks from '%s'.", saved, source_name
        )
        return {
            "success": True,
            "chunks_saved": saved,
            "message": (
                f"Successfully ingested {saved} chunk(s) from '{source_name}' "
                "into the GST rules knowledge base."
            ),
        }

    except Exception as exc:
        logger.error("[rules/upload] Unexpected error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "An error occurred while processing the file."},
        )


def _extract_keywords(text: str) -> list[str]:
    """Extract simple keyword tokens from a text chunk for keyword-search fallback."""
    import re

    # GST-specific terms to prioritize (uses module-level pattern for maintainability)
    gst_terms = re.findall(_GST_KEYWORD_PATTERN, text, re.IGNORECASE)
    # Also grab capitalized multi-word phrases (e.g. "Input Tax Credit")
    phrases = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", text)
    raw = [t.strip() for t in gst_terms + phrases]
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for kw in raw:
        lkw = kw.lower()
        if lkw not in seen:
            seen.add(lkw)
            unique.append(kw)
    return unique[:20]  # cap at 20 keywords per chunk
