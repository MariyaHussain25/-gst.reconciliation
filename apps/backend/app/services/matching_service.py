"""
3-Pass Matching Engine — PLACEHOLDER
Phase 5 will implement:
  - Pass 1: Exact match (GSTIN + normalized invoice number + amounts)
  - Pass 2: Fuzzy match (RapidFuzz token_set_ratio)
  - Pass 3: Classification (MISSING_IN_2B / MISSING_IN_BOOKS)

For now, all invoices are returned as UNMATCHED.
"""
from app.models.invoice import Invoice


async def run_exact_match_pass(user_id: str, period: str) -> list[dict]:
    """Pass 1: Exact matching — TODO Phase 5"""
    return []


async def run_fuzzy_match_pass(user_id: str, period: str) -> list[dict]:
    """Pass 2: Fuzzy matching with RapidFuzz — TODO Phase 5"""
    return []


async def run_classification_pass(user_id: str, period: str) -> list[dict]:
    """Pass 3: Classify remaining unmatched — TODO Phase 5"""
    return []


async def run_full_matching_pipeline(user_id: str, period: str) -> dict:
    """Orchestrator: runs Pass 1 → Pass 2 → Pass 3. Returns summary stats.
    TODO Phase 5: Implement with RapidFuzz.
    """
    return {
        "matched": 0,
        "fuzzy_matched": 0,
        "needs_review": 0,
        "unmatched": 0,
        "missing_in_2b": 0,
        "missing_in_books": 0,
        "value_mismatch": 0,
        "gstin_mismatch": 0,
    }
