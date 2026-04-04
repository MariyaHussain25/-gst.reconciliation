"""
AI Explanation Service — Phase 7

Uses Google GenAI direct SDK to generate plain-English explanations for each
ReconciliationResult, augmented with relevant ITC rules from the Phase 6 RAG.
"""

import logging
from typing import Optional

from app.config.settings import settings
from app.models.reconciliation import Reconciliation, ReconciliationResult
from app.services import itc_rules_service

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a senior GST (Goods and Services Tax) compliance expert in India. "
    "Given a reconciliation result between GSTR-2A and GSTR-2B, produce a concise "
    "2-3 sentence explanation in plain English. Clearly state the match status, "
    "the reason for any discrepancy, and the impact on Input Tax Credit (ITC) "
    "eligibility. Do not include disclaimers or greetings."
)

_FALLBACK = "AI explanation unavailable — please configure GOOGLE_API_KEY."


def _build_context(result: ReconciliationResult) -> str:
    """Build a human-readable context string for a single reconciliation result."""
    lines = [
        f"Match status: {result.match_status}",
        f"Match confidence: {result.match_confidence:.0%}",
    ]

    if result.gstr2a_vendor_name:
        lines.append(f"GSTR-2A vendor: {result.gstr2a_vendor_name} (GSTIN: {result.gstr2a_vendor_gstin or 'N/A'})")
    if result.gstr2b_vendor_name:
        lines.append(f"GSTR-2B vendor: {result.gstr2b_vendor_name} (GSTIN: {result.gstr2b_vendor_gstin or 'N/A'})")
    if result.gstr2b_invoice_number:
        lines.append(f"Invoice number: {result.gstr2b_invoice_number}")

    lines.append(f"Total amount difference: ₹{result.total_amount_diff:,.2f}")
    lines.append(f"Taxable amount difference: ₹{result.taxable_amount_diff:,.2f}")
    lines.append(f"IGST diff: ₹{result.igst_diff:,.2f} | CGST diff: ₹{result.cgst_diff:,.2f} | SGST diff: ₹{result.sgst_diff:,.2f}")
    lines.append(f"ITC category: {result.itc_category}")
    lines.append(f"ITC availability: {result.itc_availability}")
    lines.append(f"ITC claimable: ₹{result.itc_claimable_amount:,.2f} | ITC blocked: ₹{result.itc_blocked_amount:,.2f}")

    if result.mismatch_fields:
        lines.append(f"Mismatched fields: {', '.join(result.mismatch_fields)}")
    if result.mismatch_reason:
        lines.append(f"Mismatch reason: {result.mismatch_reason}")

    return "\n".join(lines)


def _build_rag_context(rules) -> str:
    """Format retrieved ITC rules into a concise reference block."""
    if not rules:
        return ""
    parts = ["Relevant ITC rules:"]
    for rule in rules:
        parts.append(f"- [{rule.category}] {rule.title}: {rule.description}")
    return "\n".join(parts)


def _is_google_api_key_valid(api_key: Optional[str]) -> bool:
    """Return True only if the key looks like a real Google API key."""
    if not api_key:
        return False
    if api_key.startswith("your-") or api_key == "AIza-your-key":
        return False
    return True


async def _explain_one(result: ReconciliationResult) -> str:
    """Generate an AI explanation for a single ReconciliationResult."""
    api_key = settings.GOOGLE_API_KEY
    if not _is_google_api_key_valid(api_key):
        return _FALLBACK

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)

        # 1. Look up the rule using Phase 6 Vector Search
        query = f"{result.match_status} {result.itc_category} {result.mismatch_reason or ''}"
        rules, _ = await itc_rules_service.find_relevant_rules(query, top_k=2)

        # 2. Combine the Invoice Data + The GST Rules
        context = _build_context(result)
        rag_context = _build_rag_context(rules)
        human_content = f"{context}\n\n{rag_context}" if rag_context else context

        # 3. Ask Google Gemini to explain it
        model_name = getattr(settings, "GEMINI_MODEL", "gemini-1.5-pro")
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=_SYSTEM_PROMPT
        )

        response = await model.generate_content_async(
            human_content,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=200,
            )
        )
        return response.text.strip()

    except ImportError:
        logger.error("[ai_explanation] google-generativeai package not found.")
        return _FALLBACK
    except Exception as exc:
        logger.warning(f"Failed to generate explanation: {exc}")
        return _FALLBACK


async def generate_explanations_for_reconciliation(reconciliation: Reconciliation) -> list[str]:
    """Generate AI explanation strings for each result in a Reconciliation document."""
    explanations = []
    for result in reconciliation.results:
        explanation = await _explain_one(result)
        explanations.append(explanation)
    return explanations