"""
Chatbot / RAG endpoint — Phase 6.

POST /api/chat  — accepts a free-text question about GST and returns an
AI-generated answer augmented with relevant ITC rules retrieved via keyword
search (RAG).

Supports two modes:
  • Default (Accept: application/json) → returns { reply: "…" }
  • Streaming (Accept: text/event-stream) → returns SSE stream of token chunks
"""

import json
import logging
import re
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.services import itc_rules_service
from app.config.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_CONFIG_FALLBACK = "OpenRouter is not configured, so the app is returning a rules-based answer instead."
_GENERIC_FALLBACK = "AI chat is temporarily unavailable, so the app is returning a rules-based answer instead."

_SYSTEM_PROMPT = (
    "You are a senior GST (Goods and Services Tax) compliance expert in India. "
    "Answer the user's question clearly and concisely using the provided ITC rules "
    "as context. If the rules are not relevant, answer from your general knowledge. "
    "Do not include disclaimers or greetings."
)


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    reply: str


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


async def _build_messages(query: str) -> tuple[list[dict[str, str]], list]:
    """Retrieve rule context and build the messages list for the chat API."""
    rules, _ = await itc_rules_service.find_relevant_rules(query, top_k=3)
    rag_parts: list[str] = []
    if rules:
        rag_parts.append("Relevant ITC rules:")
        for rule in rules:
            rag_parts.append(f"- [{rule.category}] {rule.title}: {rule.description}")
    rag_context = "\n".join(rag_parts)
    user_content = f"{query}\n\n{rag_context}" if rag_context else query
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ], rules


def _summarize_rule_text(text: str, limit: int = 220) -> str:
    """Trim long rule descriptions to a readable fallback length."""
    normalized = " ".join(text.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def _build_rules_based_reply(rules: list, reason: str) -> str:
    """Return a deterministic answer when OpenRouter is unavailable."""
    if not rules:
        return f"{reason} Please try again in a minute."

    parts = [reason, "", "Relevant GST rules from the current knowledge base:"]
    for rule in rules[:3]:
        title = getattr(rule, "title", "GST rule") or "GST rule"
        description = _summarize_rule_text(getattr(rule, "description", ""))
        parts.append(f"- {title}: {description}")
    parts.append("Retry shortly if you need a model-generated interpretation.")
    return "\n".join(parts)


def _describe_ai_failure(exc: Exception) -> str:
    """Map OpenRouter failures to user-facing fallback messages."""
    lowered = str(exc).lower()
    if "429" in lowered or "rate limit" in lowered:
        return "OpenRouter is temporarily rate-limited, so the app is returning a rules-based answer instead."
    if "401" in lowered or "403" in lowered or "invalid api key" in lowered:
        return "OpenRouter rejected the configured credentials, so the app is returning a rules-based answer instead."
    return _GENERIC_FALLBACK


def _strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks from a completed response."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


async def _stream_reply_text(text: str) -> AsyncGenerator[str, None]:
    """Stream a completed text reply as a single SSE response."""
    yield f"data: {json.dumps({'token': text})}\n\n"
    yield "data: [DONE]\n\n"


async def _stream_openrouter(messages: list[dict], client: AsyncOpenAI) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted chunks from an OpenRouter streaming response.

    Filters out <think>...</think> reasoning blocks that some models emit
    inline as regular content tokens.
    """
    try:
        stream = await client.chat.completions.create(
            model=settings.OPENROUTER_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=400,
            stream=True,
            extra_body={"include_reasoning": False},
        )
        in_think = False
        buf = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if not delta:
                continue
            buf += delta
            # Flush content that is outside <think> blocks
            while True:
                if in_think:
                    end = buf.find("</think>")
                    if end == -1:
                        buf = ""  # discard buffered thinking content
                        break
                    buf = buf[end + len("</think>"):]
                    in_think = False
                else:
                    start = buf.find("<think>")
                    if start == -1:
                        if buf:
                            yield f"data: {json.dumps({'token': buf})}\n\n"
                        buf = ""
                        break
                    if start > 0:
                        yield f"data: {json.dumps({'token': buf[:start]})}\n\n"
                    buf = buf[start + len("<think>"):]
                    in_think = True
        # Flush any remaining non-think content
        if buf and not in_think:
            yield f"data: {json.dumps({'token': buf})}\n\n"
    except Exception as exc:
        logger.error("[chat] OpenRouter streaming error: %s", exc)
        error_msg = "Sorry, the AI service is temporarily unavailable. Please try again."
        yield f"data: {json.dumps({'token': error_msg})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat_with_gst_assistant(request: Request):
    """Answer a GST-related question using RAG + OpenRouter AI.

    If the client sends Accept: text/event-stream, the response is streamed
    as Server-Sent Events so the frontend can display a typing animation.
    Otherwise the full reply is returned as JSON.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"reply": "Please send a valid JSON body."})

    query = body.get("query", "").strip()
    if not query:
        return JSONResponse(status_code=400, content={"reply": "Please provide a question."})

    wants_stream = "text/event-stream" in request.headers.get("accept", "")
    try:
        messages, rules = await _build_messages(query)
    except Exception as exc:
        logger.warning("[chat] Failed to build rule context: %s", exc)
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": query},
        ]
        rules = []

    client = _get_client()

    if client is None:
        fallback_reply = _build_rules_based_reply(rules, _CONFIG_FALLBACK)
        if wants_stream:
            return StreamingResponse(_stream_reply_text(fallback_reply), media_type="text/event-stream")
        return ChatResponse(reply=fallback_reply)

    try:
        # ── Streaming path ──────────────────────────────────────────────
        if wants_stream:
            return StreamingResponse(
                _stream_openrouter(messages, client),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        # ── Non-streaming path ──────────────────────────────────────────
        response = await client.chat.completions.create(
            model=settings.OPENROUTER_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=400,
            extra_body={"include_reasoning": False},
        )
        content = _extract_text_content(response.choices[0].message.content)
        reply = _strip_think_blocks(content)
        if not reply:
            raise ValueError("OpenRouter returned an empty response")
        return ChatResponse(reply=reply)

    except Exception as exc:
        logger.warning("[chat] Error generating response: %s", exc)
        fallback_reply = _build_rules_based_reply(rules, _describe_ai_failure(exc))
        if wants_stream:
            return StreamingResponse(_stream_reply_text(fallback_reply), media_type="text/event-stream")
        return ChatResponse(reply=fallback_reply)
