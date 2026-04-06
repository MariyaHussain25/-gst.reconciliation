"""
ITC Rules Service — Phase 6 RAG Knowledge Base

Provides embedding-based search (via Google GenAI text-embedding-004) with
automatic keyword-based fallback when Google is unavailable or returns no
results.
"""

import logging
import re

from app.models.gst_rule import GstRule

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def find_relevant_rules(query: str, top_k: int = 3) -> tuple[list[GstRule], str]:
    """Return the top_k most relevant rules for *query*.

    Tries embedding-based cosine similarity search first; falls back to
    keyword matching.  Never raises — always returns (rules_list, method).

    Returns:
        A tuple of (list[GstRule], search_method) where search_method is
        "embedding" or "keyword".
    """
    # 1. Attempt embedding-based search
    try:
        results = await _embedding_search(query, top_k)
        if results:
            logger.info("[itc_rules] Returned %d rules via embedding search.", len(results))
            return results, "embedding"
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("[itc_rules] Embedding search failed (%s) — falling back to keyword.", exc)

    # 2. Keyword fallback
    results = await _keyword_search(query, top_k)
    logger.info("[itc_rules] Returned %d rules via keyword fallback.", len(results))
    return results, "keyword"


async def get_rule_by_id(rule_id: str) -> GstRule | None:
    """Look up a single rule by its rule_id."""
    return await GstRule.find_one(GstRule.rule_id == rule_id)

async def get_all_active_rules() -> list[GstRule]:
    """Return all rules where is_active is True."""
    return await GstRule.find(GstRule.is_active == True).to_list()  # noqa: E712


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two equal-length vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    try:
        import numpy as np  # optional dependency

        va = np.array(a, dtype=float)
        vb = np.array(b, dtype=float)
        norm_a = np.linalg.norm(va)
        norm_b = np.linalg.norm(vb)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(va, vb) / (norm_a * norm_b))
    except ImportError:
        # Pure-Python fallback (slower but dependency-free)
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)


def _get_query_embedding(query: str) -> list[float]:
    """Generate embedding using OpenAI text-embedding-3-small via vector_service.

    Returns an empty list if the API key is missing or the call fails.
    Falls back to Google GenAI text-embedding-004 if OpenAI fails.
    """
    from app.services.vector_service import get_openai_embedding

    vec = get_openai_embedding(query)
    if vec:
        return vec

    # Secondary fallback: Google GenAI text-embedding-004
    from app.config.settings import settings

    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        logger.warning("[itc_rules] GOOGLE_API_KEY is not set. Cannot generate fallback embeddings.")
        return []

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        query = query[:10000]
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=query,
            task_type="retrieval_document",
        )
        return result["embedding"]
    except ImportError:
        logger.error("[itc_rules] google-generativeai package is not installed.")
        return []
    except Exception as exc:
        logger.error("[itc_rules] Google GenAI Embedding fallback failed: %s", exc)
        return []


async def _embedding_search(query: str, top_k: int) -> list[GstRule]:
    """Return rules sorted by cosine similarity to the query embedding.

    Returns an empty list if embedding generation fails or no rules have
    stored embeddings.
    """
    query_vec = _get_query_embedding(query)
    if not query_vec:
        return []

    all_rules = await GstRule.find(GstRule.is_active == True).to_list()  # noqa: E712
    scored: list[tuple[float, GstRule]] = []
    for rule in all_rules:
        if rule.embedding:
            score = _cosine_similarity(query_vec, rule.embedding)
            scored.append((score, rule))

    if not scored:
        return []

    scored.sort(key=lambda t: t[0], reverse=True)
    return [rule for _, rule in scored[:top_k]]


async def _keyword_search(query: str, top_k: int) -> list[GstRule]:
    """Return rules sorted by keyword overlap with the query tokens."""
    # Tokenize: lowercase words and multi-word phrases from query
    tokens = set(re.findall(r"\w+", query.lower()))

    all_rules = await GstRule.find(GstRule.is_active == True).to_list()  # noqa: E712
    scored: list[tuple[int, GstRule]] = []
    for rule in all_rules:
        # Tokenize each keyword phrase and count overlapping tokens
        rule_tokens: set[str] = set()
        for kw in rule.keywords:
            rule_tokens.update(re.findall(r"\w+", kw.lower()))
        overlap = len(tokens & rule_tokens)
        if overlap > 0:
            scored.append((overlap, rule))

    if not scored:
        # Return all active rules if no keyword match
        return all_rules[:top_k]

    scored.sort(key=lambda t: t[0], reverse=True)
    return [rule for _, rule in scored[:top_k]]
