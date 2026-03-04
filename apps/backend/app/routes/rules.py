"""ITC Rules API routes — Phase 6 RAG Knowledge Base"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.rules import RuleResponse, RuleSearchRequest, RuleSearchResponse
from app.services import itc_rules_service

router = APIRouter()


def _to_response(rule) -> RuleResponse:
    """Convert a GstRule document to a RuleResponse (strips embedding)."""
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
    """Return all active GST rules (without embeddings)."""
    rules = await itc_rules_service.get_all_active_rules()
    return [_to_response(r) for r in rules]


@router.get("/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(rule_id: str):
    """Return a single rule by its rule_id (without embedding)."""
    rule = await itc_rules_service.get_rule_by_id(rule_id)
    if rule is None:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": f"Rule '{rule_id}' not found."},
        )
    return _to_response(rule)


@router.post("/rules/search", response_model=RuleSearchResponse)
async def search_rules(body: RuleSearchRequest):
    """Search rules using RAG (embedding-based with keyword fallback)."""
    rules, method = await itc_rules_service.find_relevant_rules(
        query=body.query,
        top_k=body.top_k,
    )
    return RuleSearchResponse(
        success=True,
        rules=[_to_response(r) for r in rules],
        search_method=method,
    )
