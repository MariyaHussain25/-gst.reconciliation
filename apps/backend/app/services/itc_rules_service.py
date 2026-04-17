"""
ITC Rules Service — Phase 6 RAG Knowledge Base

Provides keyword-based search over the GstRule collection.
Embedding/vector search has been removed in favour of the simpler and
equally effective keyword fallback for this domain.
"""

from dataclasses import dataclass
from functools import lru_cache
import logging
import re
from pathlib import Path

from app.models.gst_rule import GstRule

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_RULES_DIR = _BACKEND_ROOT / "data" / "rules"

_BUNDLED_RULE_META: dict[str, tuple[str, str]] = {
    "chapter_v_itc.txt": ("ITC_ELIGIBILITY", "Chapter V — Input Tax Credit"),
    "chapter_3_rcm.txt": ("RCM", "Chapter III — Reverse Charge Mechanism"),
    "section_37_38_39_returns.txt": ("GENERAL", "Sections 37–39 — GST Returns"),
}

_QUERY_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "gst", "how", "i",
    "in", "is", "it", "me", "of", "on", "or", "please", "tell", "the", "to", "under",
    "what", "which", "with",
}


@dataclass(frozen=True)
class BundledRule:
    rule_id: str
    category: str
    title: str
    description: str
    keywords: list[str]
    gst_section: str | None = None
    gstr3b_table: str | None = None
    is_active: bool = True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def find_relevant_rules(query: str, top_k: int = 3) -> tuple[list[GstRule | BundledRule], str]:
    """Return the top_k most relevant rules for *query* using keyword matching.

    Never raises — always returns (rules_list, method).
    """
    results = await _keyword_search(query, top_k)
    logger.info("[itc_rules] Returned %d rules via keyword search.", len(results))
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

async def _keyword_search(query: str, top_k: int) -> list[GstRule | BundledRule]:
    """Return rules sorted by keyword overlap with the query tokens."""
    tokens = _extract_query_tokens(query)

    all_rules = await GstRule.find(GstRule.is_active == True).to_list()  # noqa: E712
    if not all_rules:
        bundled_rules = list(_load_bundled_rules())
        return _score_rules(tokens, bundled_rules, top_k)

    return _score_rules(tokens, all_rules, top_k)


def _rule_tokens(rule: GstRule | BundledRule) -> set[str]:
    """Collect searchable tokens from a rule object."""
    tokens: set[str] = set()
    for keyword in getattr(rule, "keywords", []):
        tokens.update(re.findall(r"\w+", keyword.lower()))

    searchable_text = " ".join(
        part
        for part in [
            getattr(rule, "title", ""),
            getattr(rule, "description", ""),
            getattr(rule, "category", ""),
            getattr(rule, "gst_section", "") or "",
        ]
        if part
    )
    tokens.update(re.findall(r"\w+", searchable_text.lower()))
    return tokens


def _extract_query_tokens(query: str) -> set[str]:
    """Normalize a user query into high-signal search tokens."""
    return {
        token
        for token in re.findall(r"\w+", query.lower())
        if len(token) > 2 and token not in _QUERY_STOPWORDS
    }


def _score_rules(tokens: set[str], rules: list[GstRule] | list[BundledRule], top_k: int) -> list[GstRule | BundledRule]:
    """Score rules by keyword overlap and return the top entries."""
    scored: list[tuple[int, GstRule | BundledRule]] = []
    for rule in rules:
        rule_tokens = _rule_tokens(rule)
        overlap = len(tokens & rule_tokens)
        if overlap > 0:
            scored.append((overlap, rule))

    if not scored:
        # Return a deterministic subset if there is no keyword match.
        return list(rules[:top_k])

    scored.sort(key=lambda t: t[0], reverse=True)
    return [rule for _, rule in scored[:top_k]]


def _derive_rule_title(default_title: str, paragraph: str, index: int) -> str:
    """Build a readable title for a bundled-rule paragraph."""
    first_sentence = re.split(r"(?<=[.!?])\s+", paragraph.strip(), maxsplit=1)[0]
    condensed = " ".join(first_sentence.split())
    if 12 <= len(condensed) <= 120:
        return condensed
    return f"{default_title} — excerpt {index + 1}"


@lru_cache(maxsize=1)
def _load_bundled_rules() -> tuple[BundledRule, ...]:
    """Load bundled GST rule text files for fallback retrieval."""
    bundled_rules: list[BundledRule] = []

    if not _RULES_DIR.exists():
        return tuple(bundled_rules)

    for path in sorted(_RULES_DIR.glob("*.txt")):
        text = path.read_text(encoding="utf-8")
        category, default_title = _BUNDLED_RULE_META.get(path.name, ("GENERAL", path.stem.replace("_", " ").title()))
        paragraphs = [
            " ".join(block.split())
            for block in re.split(r"\n\s*\n", text)
            if len(block.strip()) >= 80
        ]

        for index, paragraph in enumerate(paragraphs):
            title = _derive_rule_title(default_title, paragraph, index)
            keywords = sorted(set(re.findall(r"\w+", f"{default_title} {paragraph}".lower())))[:30]
            bundled_rules.append(
                BundledRule(
                    rule_id=f"builtin:{path.stem}:{index}",
                    category=category,
                    title=title,
                    description=paragraph,
                    keywords=keywords,
                    gst_section=default_title,
                )
            )

    return tuple(bundled_rules)
