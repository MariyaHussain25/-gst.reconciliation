"""
AI Explanation Service — minimal-token variant

Goal: produce concise (≤2 sentences) explanations with minimal token usage.
Approach: one short system prompt + compact human context; no RAG calls.
"""

import logging
from typing import Optional

from app.config.settings import settings
from app.models.reconciliation import Reconciliation, ReconciliationResult

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a GST expert. Reply in 2 short sentences MAX. No preamble, no caveats."
)

_FALLBACK = "AI explanation unavailable — please configure GOOGLE_API_KEY."


def _build_context(result: ReconciliationResult) -> str:
    """Build a compact, single-paragraph context for minimal tokens."""
    def _t(s: Optional[str], n: int = 40) -> str:
        if not s:
            return ""
        s = s.strip()
        return (s[: n - 1] + "…") if len(s) > n else s

    parts: list[str] = []
    parts.append(f"Status={result.match_status} ({int(result.match_confidence)}%).")
    if result.gstr2b_invoice_number:
        parts.append(f"Inv={_t(result.gstr2b_invoice_number, 24)}.")
    v2a = _t(result.gstr2a_vendor_name, 28)
    v2b = _t(result.gstr2b_vendor_name, 28)
    if v2a or v2b:
        parts.append(f"Vendors: 2A='{v2a or '-'}' vs 2B='{v2b or '-'}'.")
    if any([result.total_amount_diff, result.taxable_amount_diff, result.igst_diff, result.cgst_diff, result.sgst_diff]):
        parts.append(
            f"Deltas: total={result.total_amount_diff:.0f}, tax={result.taxable_amount_diff:.0f}, "
            f"IGST={result.igst_diff:.0f}, CGST={result.cgst_diff:.0f}, SGST={result.sgst_diff:.0f}."
        )
    parts.append(f"ITC={result.itc_category}; avail={result.itc_availability}.")
    if result.mismatch_reason:
        parts.append(f"Reason={_t(result.mismatch_reason, 50)}.")
    return " ".join(p for p in parts if p)


def _build_rag_context() -> str:
    """Placeholder to hint at rule-awareness without extra token use."""
    return "Ref: relevant ITC rule(s) considered."


def _is_google_api_key_valid(api_key: Optional[str]) -> bool:
    """Return True only if the key looks like a real Google API key."""
    if not api_key:
        return False
    if api_key.startswith("your-") or api_key == "AIza-your-key":
        return False
    return True


async def _explain_one(result: ReconciliationResult) -> str:
    """Generate an AI explanation for a single ReconciliationResult.

    Returns the explanation string or the fallback string — never raises.
    """
    if not _is_google_api_key_valid(settings.GOOGLE_API_KEY):
        return _FALLBACK

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage

        # Build ultra-compact prompt to minimize tokens
        human_content = f"{_build_context(result)} {_build_rag_context()}"

        llm = ChatGoogleGenerativeAI(
            model=(settings.GEMINI_MODEL or "gemini-1.5-flash-002"),
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.1,
            max_output_tokens=60,
        )

        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = await llm.ainvoke(messages)
        return response.content.strip()

    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("[ai_explanation] Failed to generate explanation: %s", exc)
        return _FALLBACK


async def generate_explanations_for_reconciliation(reconciliation: Reconciliation) -> list[str]:
    """Generate AI explanation strings for each result in a Reconciliation document.

    Returns a list of explanation strings (same length as reconciliation.results).
    Never raises.
    """
    explanations: list[str] = []
    for result in reconciliation.results:
        explanation = await _explain_one(result)
        explanations.append(explanation)
    return explanations
