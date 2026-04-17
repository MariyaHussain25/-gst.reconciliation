"""
AI Explanation Service — Phase 7

Uses OpenRouter (OpenAI-compatible API) to generate plain-English explanations
for each ReconciliationResult, augmented with relevant ITC rules via keyword search.
"""

import logging
import re

from openai import AsyncOpenAI

from app.config.settings import settings
from app.models.reconciliation import Reconciliation, ReconciliationResult
from app.services import itc_rules_service

logger = logging.getLogger(__name__)

_MAX_AI_ENRICHED_RESULTS = 5


def _strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks from the response."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

_SYSTEM_PROMPT = (
    "You are a senior GST (Goods and Services Tax) compliance expert in India. "
    "Given a reconciliation result between GSTR-2A and GSTR-2B, produce a concise "
    "2-3 sentence explanation in plain English. Clearly state the match status, "
    "the reason for any discrepancy, and the impact on Input Tax Credit (ITC) "
    "eligibility. Do not include disclaimers or greetings."
)


def _extract_text_content(content: object) -> str:
    """Normalize OpenRouter content payloads into a plain string."""
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts).strip()

    return ""


def _format_currency(amount: float) -> str:
    return f"Rs. {amount:,.2f}"


def _build_template_explanation(result: ReconciliationResult) -> str:
    """Generate a deterministic explanation when AI is unavailable or skipped."""
    invoice_ref = result.gstr2b_invoice_number or result.gstr2a_vch_no or "this invoice"
    vendor = result.gstr2b_vendor_name or result.gstr2a_vendor_name or "the supplier"
    reason = (result.mismatch_reason or "").strip()
    reason_sentence = f" {reason}" if reason else ""
    itc_sentence = (
        f" ITC is currently marked {result.itc_availability.lower()} under {result.itc_category}, "
        f"with claimable tax of {_format_currency(result.itc_claimable_amount)} and blocked tax of {_format_currency(result.itc_blocked_amount)}."
    )

    if result.match_status in {"EXACT_MATCH", "MATCHED"}:
        return (
            f"{invoice_ref} from {vendor} matches across Books and GSTR-2B with no material discrepancy."
            f"{itc_sentence}"
        )

    if result.match_status == "FUZZY_MATCH":
        return (
            f"{invoice_ref} from {vendor} was matched using GSTIN and amount tolerance rather than an exact document match."
            f"{reason_sentence or ' Review the invoice reference if the document numbering differs across systems.'}"
            f"{itc_sentence}"
        )

    if result.match_status == "MISSING_IN_2B":
        return (
            f"{invoice_ref} from {vendor} exists in Books but is not present in GSTR-2B for the selected period."
            f"{reason_sentence or ' Verify whether the supplier has filed the invoice in the correct return period before claiming ITC.'}"
            f"{itc_sentence}"
        )

    if result.match_status == "MISSING_IN_BOOKS":
        return (
            f"{invoice_ref} from {vendor} appears in GSTR-2B but is missing from Books."
            f"{reason_sentence or ' Check whether the purchase entry is missing, duplicated in another period, or belongs to another entity.'}"
            f"{itc_sentence}"
        )

    amount_sentence = f" Total amount difference is {_format_currency(result.total_amount_diff)}."
    return (
        f"{invoice_ref} from {vendor} is marked as {result.match_status.replace('_', ' ').title()}."
        f"{reason_sentence or ' Review the mismatched fields and supporting documents before finalizing the claim.'}"
        f"{amount_sentence}{itc_sentence}"
    )


def _should_try_ai(result: ReconciliationResult) -> bool:
    """Only spend AI calls on results that benefit from extra narrative context."""
    existing = (result.ai_explanation or "").strip()
    mismatch_reason = (result.mismatch_reason or "").strip()
    if existing and existing != mismatch_reason:
        return False
    return result.match_status not in {"EXACT_MATCH", "MATCHED"}


def _should_disable_ai(exc: Exception) -> bool:
    """Stop further provider calls after rate-limit or auth failures."""
    lowered = str(exc).lower()
    return (
        "429" in lowered
        or "rate limit" in lowered
        or "401" in lowered
        or "403" in lowered
        or "invalid api key" in lowered
    )


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


def _get_client() -> AsyncOpenAI | None:
    """Return an OpenRouter AsyncOpenAI client, or None if the key is not set."""
    api_key = settings.OPENROUTER_API_KEY
    if not api_key or api_key.startswith("your-"):
        return None
    return AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "GST Reconciliation",
        },
    )


async def _generate_ai_explanation(client: AsyncOpenAI, result: ReconciliationResult) -> str:
    """Generate an OpenRouter explanation for a single reconciliation result."""
    query = f"{result.match_status} {result.itc_category} {result.mismatch_reason or ''}"
    rules, _ = await itc_rules_service.find_relevant_rules(query, top_k=2)

    context = _build_context(result)
    rag_context = _build_rag_context(rules)
    human_content = f"{context}\n\n{rag_context}" if rag_context else context

    response = await client.chat.completions.create(
        model=settings.OPENROUTER_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": human_content},
        ],
        temperature=0.2,
        max_tokens=200,
        extra_body={"include_reasoning": False},
    )

    content = _extract_text_content(response.choices[0].message.content)
    reply = _strip_think_blocks(content)
    if not reply:
        raise ValueError("OpenRouter returned an empty explanation")
    return reply


async def generate_explanations_for_reconciliation(reconciliation: Reconciliation) -> tuple[list[str], int]:
    """Generate explanation strings for each result in a Reconciliation document."""
    explanations: list[str] = []
    ai_enriched_count = 0
    client = _get_client()
    ai_enabled = client is not None

    for result in reconciliation.results:
        if ai_enabled and client is not None and ai_enriched_count < _MAX_AI_ENRICHED_RESULTS and _should_try_ai(result):
            try:
                explanation = await _generate_ai_explanation(client, result)
                ai_enriched_count += 1
                explanations.append(explanation)
                continue
            except Exception as exc:
                logger.warning("[ai_explanation] Failed to generate explanation: %s", exc)
                if _should_disable_ai(exc):
                    ai_enabled = False

        explanation = _build_template_explanation(result)
        explanations.append(explanation)
    return explanations, ai_enriched_count