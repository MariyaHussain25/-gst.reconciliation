"""
Chatbot / RAG endpoint — Phase 6.

POST /api/chat  — accepts a free-text question about GST and returns an
AI-generated answer augmented with relevant ITC rules retrieved via keyword
search (RAG).

Supports two modes:
  • Default (Accept: application/json)   → returns { reply: "…" }
  • Streaming (Accept: text/event-stream) → returns SSE stream of token chunks

Model strategy (April 2026):
  Primary: openrouter/free  — OpenRouter's own router that automatically picks
           whichever free model is available right now. Never returns 404.
  Fallbacks (in order, tried on 429 or any error from primary):
    1. google/gemma-3-27b-it:free
    2. deepseek/deepseek-r1:free
    3. qwen/qwen3-8b:free
    → deterministic template (always works, no API call)

Set OPENROUTER_MODEL=openrouter/free in your .env for best reliability.
"""

import asyncio
import json
import logging
import re
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config.settings import settings
from app.services import itc_rules_service

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Model chain ───────────────────────────────────────────────────
# openrouter/free is tried first — it auto-selects whatever free model
# is currently available, so it never returns 404 for "model not found".
# Individual model IDs are tried only as fallbacks if the router fails.
_FALLBACK_MODELS = [
    "google/gemma-3-27b-it:free",
    "deepseek/deepseek-r1:free",
    "qwen/qwen3-8b:free",
]

_CONFIG_FALLBACK = (
    "OpenRouter is not configured. "
    "Please add OPENROUTER_API_KEY to your .env file."
)
_GENERIC_FALLBACK = (
    "All AI models are temporarily busy. "
    "Here are the relevant GST rules I found:"
)

_SYSTEM_PROMPT = (
    "You are a senior GST (Goods and Services Tax) compliance expert in India. "
    "Answer the user's question clearly and concisely using the provided ITC rules "
    "as context. If the rules are not relevant, answer from your general knowledge. "
    "Do not include disclaimers or greetings. Keep your answer under 200 words."
)


class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    reply: str


# ── Helpers ───────────────────────────────────────────────────────

def _extract_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content if isinstance(item, dict)
        ).strip()
    return ""


def _strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _get_client() -> AsyncOpenAI | None:
    api_key = (getattr(settings, "OPENROUTER_API_KEY", "") or "").strip()
    if not api_key or api_key.startswith("your-") or len(api_key) < 20:
        logger.warning("[chat] OPENROUTER_API_KEY missing or placeholder.")
        return None
    return AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "GST Reconciliation",
        },
    )


def _model_chain() -> list[str]:
    """
    Returns the model list to try in order.
    Primary from .env (ideally 'openrouter/free'), then named fallbacks.
    """
    primary = (getattr(settings, "OPENROUTER_MODEL", "") or "").strip()
    if not primary:
        primary = "openrouter/free"
    return [primary] + [m for m in _FALLBACK_MODELS if m != primary]


def _is_404(exc: Exception) -> bool:
    s = str(exc).lower()
    return "404" in s or "no endpoints found" in s


def _is_429(exc: Exception) -> bool:
    return "429" in str(exc)


def _is_auth(exc: Exception) -> bool:
    s = str(exc).lower()
    return "401" in s or "403" in s or "invalid api key" in s


def _should_try_next(exc: Exception) -> bool:
    """Returns True for errors where trying the next model makes sense."""
    return _is_404(exc) or _is_429(exc)


def _describe(exc: Exception) -> str:
    if _is_429(exc):
        return "AI models are temporarily rate-limited. Showing rules-based answer."
    if _is_auth(exc):
        return "OpenRouter API key error. Please check OPENROUTER_API_KEY in .env."
    return _GENERIC_FALLBACK


def _summarize(text: str, limit: int = 260) -> str:
    n = " ".join(text.split())
    return n if len(n) <= limit else n[:limit - 3].rstrip() + "..."


def _rules_reply(rules: list, reason: str) -> str:
    parts = [reason]
    if rules:
        parts.append("")
        for rule in rules[:3]:
            title = getattr(rule, "title", "") or "GST Rule"
            desc  = _summarize(getattr(rule, "description", ""))
            parts.append(f"• {title}: {desc}")
        parts.append("\nRetry shortly for an AI-generated interpretation.")
    else:
        parts.append("Please try again in a minute.")
    return "\n".join(parts)


async def _build_messages(query: str) -> tuple[list[dict], list]:
    rules, _ = await itc_rules_service.find_relevant_rules(query, top_k=3)
    rag = ""
    if rules:
        lines = ["Relevant ITC rules:"]
        for r in rules:
            lines.append(f"- [{r.category}] {r.title}: {r.description[:300]}")
        rag = "\n".join(lines)
    user_content = f"{query}\n\n{rag}" if rag else query
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user",   "content": user_content},
    ], rules


# ── Streaming ─────────────────────────────────────────────────────

async def _stream_text(text: str) -> AsyncGenerator[str, None]:
    yield f"data: {json.dumps({'token': text})}\n\n"
    yield "data: [DONE]\n\n"


async def _stream_openrouter(
    messages: list[dict],
    client: AsyncOpenAI,
    rules: list,
) -> AsyncGenerator[str, None]:
    """
    Stream from OpenRouter with full fallback chain.
    Handles 404, 429, and unexpected errors — always yields something.
    """
    chain = _model_chain()

    for model in chain:
        try:
            logger.info(f"[chat] Streaming with model: {model}")
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=400,
                stream=True,
                extra_body={"include_reasoning": False},
            )

            in_think = False
            buf = ""
            yielded_something = False

            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if not delta:
                    continue
                buf += delta

                while True:
                    if in_think:
                        end = buf.find("</think>")
                        if end == -1:
                            buf = ""
                            break
                        buf = buf[end + len("</think>"):]
                        in_think = False
                    else:
                        start = buf.find("<think>")
                        if start == -1:
                            if buf:
                                yield f"data: {json.dumps({'token': buf})}\n\n"
                                yielded_something = True
                            buf = ""
                            break
                        if start > 0:
                            yield f"data: {json.dumps({'token': buf[:start]})}\n\n"
                            yielded_something = True
                        buf = buf[start + len("<think>"):]
                        in_think = True

            if buf and not in_think:
                yield f"data: {json.dumps({'token': buf})}\n\n"
                yielded_something = True

            if yielded_something:
                yield "data: [DONE]\n\n"
                logger.info(f"[chat] Stream succeeded: {model}")
                return

            # Model returned empty response — try next
            logger.warning(f"[chat] Model '{model}' returned empty response. Trying next.")
            continue

        except Exception as exc:
            logger.error(f"[chat] Model '{model}' error: {type(exc).__name__}: {exc}")
            if _is_auth(exc):
                break  # auth errors won't be fixed by trying another model
            if _should_try_next(exc):
                if _is_429(exc):
                    await asyncio.sleep(2)
                continue
            continue  # unknown errors: try next anyway

    # All models failed
    fallback = _rules_reply(rules, _GENERIC_FALLBACK)
    yield f"data: {json.dumps({'token': fallback})}\n\n"
    yield "data: [DONE]\n\n"


# ── Non-streaming ─────────────────────────────────────────────────

async def _call_sync(messages: list[dict], client: AsyncOpenAI) -> str:
    chain = _model_chain()
    last_exc: Exception | None = None

    for model in chain:
        try:
            logger.info(f"[chat] Sync call: {model}")
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=400,
                    extra_body={"include_reasoning": False},
                ),
                timeout=20.0,
            )
            text = _strip_think(_extract_text(response.choices[0].message.content))
            if text:
                logger.info(f"[chat] Sync succeeded: {model}")
                return text
            logger.warning(f"[chat] Empty response from {model}, trying next.")
            continue

        except Exception as exc:
            last_exc = exc
            logger.error(f"[chat] {model} error: {type(exc).__name__}: {exc}")
            if _is_auth(exc):
                break
            if _should_try_next(exc):
                if _is_429(exc):
                    await asyncio.sleep(2)
                continue
            continue

    raise last_exc or RuntimeError("All models failed.")


# ── Route ─────────────────────────────────────────────────────────

@router.post("/chat")
async def chat_with_gst_assistant(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"reply": "Please send a valid JSON body."})

    query = (body.get("query") or "").strip()
    if not query:
        return JSONResponse(status_code=400, content={"reply": "Please provide a question."})

    wants_stream = "text/event-stream" in request.headers.get("accept", "")

    try:
        messages, rules = await _build_messages(query)
    except Exception as exc:
        logger.warning(f"[chat] Rule retrieval failed: {exc}")
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": query},
        ]
        rules = []

    client = _get_client()
    if client is None:
        reply = _rules_reply(rules, _CONFIG_FALLBACK)
        if wants_stream:
            return StreamingResponse(_stream_text(reply), media_type="text/event-stream")
        return ChatResponse(reply=reply)

    if wants_stream:
        return StreamingResponse(
            _stream_openrouter(messages, client, rules),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        reply = await _call_sync(messages, client)
        return ChatResponse(reply=reply)
    except Exception as exc:
        logger.warning(f"[chat] All models failed: {exc}")
        return ChatResponse(reply=_rules_reply(rules, _describe(exc)))