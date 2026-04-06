"""
Chatbot / RAG endpoint — Phase 6.

POST /api/chat  — accepts a free-text question about GST and returns an
AI-generated answer augmented with relevant ITC rules retrieved from the
MongoDB Atlas Vector Search (RAG).
"""

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
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


@router.post("/chat", response_model=ChatResponse)
async def chat_with_gst_assistant(request: ChatRequest):
    """Answer a GST-related question using RAG + Gemini AI."""
    try:
        # 1. Retrieve relevant ITC rules from MongoDB Vector Search
        rules, _ = await itc_rules_service.find_relevant_rules(request.query, top_k=3)

        # 2. Build RAG context from retrieved rules
        rag_parts = []
        if rules:
            rag_parts.append("Relevant ITC rules:")
            for rule in rules:
                rag_parts.append(f"- [{rule.category}] {rule.title}: {rule.description}")
        rag_context = "\n".join(rag_parts)

        full_prompt = f"{request.query}\n\n{rag_context}" if rag_context else request.query

        # 3. Check Google API key
        api_key = settings.GOOGLE_API_KEY
        if not api_key or api_key.startswith("your-") or api_key == "AIza-your-key":
            return ChatResponse(reply=_FALLBACK)

        # 4. Generate answer using Gemini
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
        return JSONResponse(
            status_code=500,
            content={"reply": "An error occurred while processing your request."},
        )
