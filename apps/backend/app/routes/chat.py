"""
Chatbot / RAG endpoint — Phase 6.

POST /api/chat  — accepts a free-text question about GST and returns an
AI-generated answer augmented with relevant ITC rules retrieved from the
MongoDB Atlas Vector Search (RAG).

Supports two modes:
  • Default (Accept: application/json) → returns { reply: "…" }
  • Streaming (Accept: text/event-stream) → returns SSE stream of token chunks
"""

import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services import itc_rules_service
from app.config.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_FALLBACK = "AI chat is unavailable — please configure GOOGLE_API_KEY."

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


def _check_api_key() -> str | None:
    """Return the Google API key or None if not configured."""
    api_key = settings.GOOGLE_API_KEY
    if not api_key or api_key.startswith("your-") or api_key == "AIza-your-key":
        return None
    return api_key


async def _build_prompt(query: str) -> str:
    """Retrieve RAG context and build the full prompt string."""
    rules, _ = await itc_rules_service.find_relevant_rules(query, top_k=3)
    rag_parts: list[str] = []
    if rules:
        rag_parts.append("Relevant ITC rules:")
        for rule in rules:
            rag_parts.append(f"- [{rule.category}] {rule.title}: {rule.description}")
    rag_context = "\n".join(rag_parts)
    return f"{query}\n\n{rag_context}" if rag_context else query


async def _stream_gemini(full_prompt: str, api_key: str) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted chunks from a Gemini streaming response."""
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=_SYSTEM_PROMPT,
        )
        response = await model.generate_content_async(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=400,
            ),
            stream=True,
        )
        async for chunk in response:
            text = chunk.text
            if text:
                yield f"data: {json.dumps({'token': text})}\n\n"
    except Exception as exc:
        logger.error("[chat] Gemini streaming error: %s", exc)
        error_msg = "Sorry, the AI service is temporarily unavailable (rate limit exceeded). Please try again in a minute."
        yield f"data: {json.dumps({'token': error_msg})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat_with_gst_assistant(request: Request):
    """Answer a GST-related question using RAG + Gemini AI.

    If the client sends Accept: text/event-stream, the response is streamed
    as Server-Sent Events so the frontend can display a typing animation.
    Otherwise the full reply is returned as JSON.
    """
    body = await request.json()
    query = body.get("query", "").strip()
    if not query:
        return JSONResponse(status_code=400, content={"reply": "Please provide a question."})

    wants_stream = "text/event-stream" in request.headers.get("accept", "")

    try:
        api_key = _check_api_key()
        if not api_key:
            if wants_stream:
                async def _fb() -> AsyncGenerator[str, None]:
                    yield f"data: {json.dumps({'token': _FALLBACK})}\n\n"
                    yield "data: [DONE]\n\n"
                return StreamingResponse(_fb(), media_type="text/event-stream")
            return ChatResponse(reply=_FALLBACK)

        full_prompt = await _build_prompt(query)

        # ── Streaming path ──────────────────────────────────────────────
        if wants_stream:
            return StreamingResponse(
                _stream_gemini(full_prompt, api_key),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        # ── Non-streaming path (backwards compat) ──────────────────────
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=_SYSTEM_PROMPT,
        )
        response = await model.generate_content_async(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=400,
            ),
        )
        return ChatResponse(reply=response.text.strip())

    except ImportError:
        logger.error("[chat] google-generativeai package not found.")
        return ChatResponse(reply=_FALLBACK)
    except Exception as exc:
        logger.warning("[chat] Error generating response: %s", exc)
        if wants_stream:
            async def _err() -> AsyncGenerator[str, None]:
                yield f"data: {json.dumps({'token': 'An error occurred while processing your request.'})}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(_err(), media_type="text/event-stream")
        return JSONResponse(
            status_code=500,
            content={"reply": "An error occurred while processing your request."},
        )
