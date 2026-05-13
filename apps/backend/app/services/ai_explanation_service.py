"""
AI Explanation Service — Phase 7

Uses OpenRouter (OpenAI-compatible API) to generate plain-English explanations
for each ReconciliationResult, augmented with relevant ITC rules via keyword search.

This service now runs as a background task (not in the HTTP request path),
so timeouts and rate limits no longer cause ECONNRESET errors on the frontend.

Model fallback chain (update as OpenRouter availability changes):
  1. settings.OPENROUTER_MODEL  (from .env)
  2. google/gemma-3-27b-it:free
  3. meta-llama/llama-3.1-8b-instruct:free
  → template fallback (always succeeds, no API call needed)
"""

import asyncio
import logging
import re
from openai import AsyncOpenAI

from app.config.settings import settings
from app.models.reconciliation import Reconciliation, ReconciliationResult
from app.services import itc_rules_service

logger = logging.getLogger(__name__)

_MAX_AI_ENRICHED_RESULTS = 50   # lowered — background task, be gentle on free tier

# Fallback models tried in order when the primary model returns 404/unavailable.
# Check https://openrouter.ai/models?q=free for currently available free models.
_FALLBACK_MODELS = [
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.1-8b-instruct:free",
]

_SYSTEM_PROMPT = (
    "You are a senior GST (Goods and Services Tax) compliance expert in India. "
    "Given a reconciliation result between GSTR-2A and GSTR-2B, produce a concise "
    "2-3 sentence explanation in plain English. Clearly state the match status, "
    "the reason for any discrepancy, and the impact on Input Tax Credit (ITC) "
    "eligibility. Do not include disclaimers or greetings."
)


# ── Text helpers ──────────────────────────────────────────────────────────────

def _strip_think_blocks(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _extract_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content if isinstance(item, dict)
        ).strip()
    return ""


def _fmt(amount: float) -> str:
    return f"Rs. {amount:,.2f}"


# ── Client ────────────────────────────────────────────────────────────────────

def _get_client() -> AsyncOpenAI | None:
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


# ── Context builders ──────────────────────────────────────────────────────────

def _build_context(result: ReconciliationResult) -> str:
    lines = [
        f"Match status: {result.match_status}",
        f"Match confidence: {result.match_confidence:.0%}",
    ]
    if result.gstr2a_vendor_name:
        lines.append(f"GSTR-2A vendor: {result.gstr2a_vendor_name} (GSTIN: {result.gstr2a_vendor_gstin or 'N/A'})")
    if result.gstr2b_vendor_name:
        lines.append(f"GSTR-2B vendor: {result.gstr2b_vendor_name} (GSTIN: {result.gstr2b_vendor_gstin or 'N/A'})")
    if result.gstr2b_invoice_number:
        lines.append(f"Invoice: {result.gstr2b_invoice_number}")
    lines += [
        f"Total diff: Rs.{result.total_amount_diff:,.2f}",
        f"Taxable diff: Rs.{result.taxable_amount_diff:,.2f}",
        f"ITC category: {result.itc_category} | ITC: {result.itc_availability}",
        f"Claimable: Rs.{result.itc_claimable_amount:,.2f} | Blocked: Rs.{result.itc_blocked_amount:,.2f}",
    ]
    if result.mismatch_fields:
        lines.append(f"Mismatched fields: {', '.join(result.mismatch_fields)}")
    if result.mismatch_reason:
        lines.append(f"Reason: {result.mismatch_reason}")
    return "\n".join(lines)


def _build_rag_context(rules) -> str:
    if not rules:
        return ""
    parts = ["Relevant ITC rules:"]
    for rule in rules:
        parts.append(f"- [{rule.category}] {rule.title}: {rule.description[:200]}")
    return "\n".join(parts)


# ── Template fallback ─────────────────────────────────────────────────────────

def _build_template_explanation(result: ReconciliationResult) -> str:
    """Deterministic fallback — no API call needed, always succeeds instantly."""
    inv = (
        result.gstr2b_invoice_number
        or getattr(result, "gstr2a_invoice_number", None)
        or result.gstr2a_vch_no
        or "This invoice"
    )
    vendor  = result.gstr2b_vendor_name or result.gstr2a_vendor_name or "the supplier"
    reason  = (result.mismatch_reason or "").strip()
    rs      = f" {reason}" if reason else ""
    itc_str = (
        f" ITC is {result.itc_availability.lower()} under {result.itc_category}; "
        f"claimable: {_fmt(result.itc_claimable_amount)}, "
        f"blocked: {_fmt(result.itc_blocked_amount)}."
    )
    s = result.match_status

    if s in {"EXACT_MATCH", "MATCHED"}:
        return f"{inv} from {vendor} matches exactly across GSTR-2A and GSTR-2B.{itc_str}"

    if s == "FUZZY_MATCH":
        return (
            f"{inv} from {vendor} was matched using GSTIN and amount/name similarity."
            f"{rs or ' Review the invoice reference if numbering differs.'}{itc_str}"
        )
    if s == "MISMATCH":
        diff = f"Rs.{abs(result.total_amount_diff):,.2f}"
        return (
            f"{inv} from {vendor} has matching GSTIN and invoice number but amounts "
            f"differ by {diff}.{rs or ' Verify whether the supplier amended the invoice.'}{itc_str}"
        )
    if s == "MISSING_IN_2B":
        return (
            f"{inv} from {vendor} exists in GSTR-2A but is absent from GSTR-2B."
            f"{rs or ' The supplier may not have filed GSTR-1 in time for this period.'}{itc_str}"
        )
    if s == "MISSING_IN_BOOKS":
        return (
            f"{inv} from {vendor} appears in GSTR-2B but has no corresponding GSTR-2A entry."
            f"{rs or ' Verify whether the entry is missing or recorded in another period.'}{itc_str}"
        )
    return (
        f"{inv} from {vendor} is marked {s.replace('_', ' ').title()}."
        f"{rs or ' Review mismatched fields and supporting documents.'}{itc_str}"
    )


# ── Error classification ──────────────────────────────────────────────────────

def _is_auth_error(exc: Exception) -> bool:
    s = str(exc).lower()
    return "401" in s or "403" in s or "invalid api key" in s


def _is_model_unavailable(exc: Exception) -> bool:
    s = str(exc).lower()
    return "404" in s or "no endpoints found" in s


def _is_rate_limit(exc: Exception) -> bool:
    return "429" in str(exc)


# ── Model call with fallback chain ────────────────────────────────────────────

async def _call_model(client: AsyncOpenAI, model: str, human_content: str) -> str:
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": human_content},
            ],
            temperature=0.2,
            max_tokens=200,
            extra_body={"include_reasoning": False},
        ),
        timeout=15.0,
    )
    text = _strip_think_blocks(_extract_text(response.choices[0].message.content))
    if not text:
        raise ValueError("Model returned empty response")
    return text


async def _generate_ai_explanation(
    client: AsyncOpenAI,
    result: ReconciliationResult,
    working_model: list[str],
) -> str:
    """
    Try working_model[0] first, fall back through _FALLBACK_MODELS on 404.
    Updates working_model[0] in-place when a better model is found.
    """
    query        = f"{result.match_status} {result.itc_category} {result.mismatch_reason or ''}"
    rules, _     = await itc_rules_service.find_relevant_rules(query, top_k=2)
    context      = _build_context(result)
    rag          = _build_rag_context(rules)
    human        = f"{context}\n\n{rag}" if rag else context

    primary      = working_model[0]
    trial_order  = [primary] + [m for m in _FALLBACK_MODELS if m != primary]

    for model in trial_order:
        try:
            text = await _call_model(client, model, human)
            if model != primary:
                logger.info(f"[ai_explanation] Switched to fallback model: {model}")
                working_model[0] = model
            return text
        except Exception as exc:
            if _is_model_unavailable(exc):
                logger.warning(f"[ai_explanation] Model '{model}' not available (404). Trying next.")
                continue
            raise   # rate limit, timeout, auth → let caller handle

    raise RuntimeError("All models in fallback chain are unavailable.")


# ── Filter helper ─────────────────────────────────────────────────────────────

def _should_try_ai(result: ReconciliationResult) -> bool:
    existing = (result.ai_explanation or "").strip()
    mismatch = (result.mismatch_reason or "").strip()
    if existing and existing != mismatch:
        return False
    return result.match_status not in {"EXACT_MATCH", "MATCHED"}


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_explanations_for_reconciliation(
    reconciliation: Reconciliation,
) -> tuple[list[str], int]:
    """
    Generate explanations for all results. Runs as a background task.
    Never raises. Returns (explanations, ai_enriched_count).
    """
    try:
        explanations:         list[str] = []
        ai_enriched_count:    int       = 0
        consecutive_failures: int       = 0
        rate_limit_pause:     float     = 5.0

        client        = _get_client()
        ai_enabled    = client is not None
        working_model = [settings.OPENROUTER_MODEL]

        for result in reconciliation.results:
            if (
                ai_enabled
                and client is not None
                and ai_enriched_count < _MAX_AI_ENRICHED_RESULTS
                and _should_try_ai(result)
            ):
                try:
                    text = await _generate_ai_explanation(client, result, working_model)
                    ai_enriched_count    += 1
                    consecutive_failures  = 0
                    explanations.append(text)
                    await asyncio.sleep(0.5)
                    continue

                except asyncio.CancelledError:
                    logger.warning(
                        "[ai_explanation] Task cancelled mid-loop — returning partial results."
                    )
                    explanations.append(_build_template_explanation(result))
                    return explanations, ai_enriched_count

                except Exception as exc:
                    logger.warning("[ai_explanation] Failed: %s", exc)
                    consecutive_failures += 1

                    if _is_auth_error(exc):
                        logger.error("[ai_explanation] Auth error — disabling AI for this run.")
                        ai_enabled = False

                    elif _is_rate_limit(exc):
                        logger.info(
                            f"[ai_explanation] Rate limited — pausing {rate_limit_pause:.0f}s."
                        )
                        try:
                            await asyncio.sleep(rate_limit_pause)
                        except asyncio.CancelledError:
                            logger.warning(
                                "[ai_explanation] Cancelled during rate-limit sleep — returning partial results."
                            )
                            explanations.append(_build_template_explanation(result))
                            return explanations, ai_enriched_count

                        rate_limit_pause = min(rate_limit_pause * 2, 60.0)
                        consecutive_failures = 0
                        explanations.append(_build_template_explanation(result))
                        continue

                    elif consecutive_failures >= 3:
                        logger.info(
                            "[ai_explanation] 3 consecutive failures — pausing 10s, switching to templates."
                        )
                        try:
                            await asyncio.sleep(10)
                        except asyncio.CancelledError:
                            logger.warning(
                                "[ai_explanation] Cancelled during failure-pause sleep — returning partial results."
                            )
                            explanations.append(_build_template_explanation(result))
                            return explanations, ai_enriched_count
                        ai_enabled = False

            explanations.append(_build_template_explanation(result))

        logger.info(
            f"[ai_explanation] Done: {ai_enriched_count} AI-generated, "
            f"{len(explanations) - ai_enriched_count} template-generated."
        )
        return explanations, ai_enriched_count

    except asyncio.CancelledError:
        logger.warning(
            "[ai_explanation] generate_explanations_for_reconciliation cancelled — returning partial results."
        )
        return [], 0

    except Exception as exc:
        logger.error(
            f"[ai_explanation] Unexpected error in generate_explanations_for_reconciliation: {exc}"
        )
        return [], 0