"""
ITC Rules Seed Script — Phase 6
Run once manually: cd apps/backend && python -m scripts.seed_rules

Seeds 5 ITC rules into the gst_rules MongoDB collection with embeddings
generated via OpenAI text-embedding-3-small. If OpenAI is unavailable,
rules are saved with an empty embedding field.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Allow running as: python -m scripts.seed_rules from apps/backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config.settings import settings
from app.models.gst_rule import GstRule

logging.basicConfig(level=logging.INFO, format="[seed_rules] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------

RULES_DATA = [
    {
        "rule_id": "ITC_ELIGIBILITY_S16",
        "category": "ITC_ELIGIBILITY",
        "title": "ITC Eligibility — Section 16 Conditions",
        "gst_section": "Section 16",
        "gstr3b_table": "Table 4",
        "keywords": [
            "itc",
            "input tax credit",
            "eligibility",
            "section 16",
            "tax invoice",
            "debit note",
            "section 37",
            "section 38",
            "section 39",
        ],
        "source_file": "chapter_v_itc.txt",
    },
    {
        "rule_id": "BLOCKED_ITC_S17",
        "category": "BLOCKED_ITC",
        "title": "Blocked ITC — Section 17(5)",
        "gst_section": "Section 17(5)",
        "gstr3b_table": "Table 4(D)",
        "keywords": [
            "blocked itc",
            "section 17",
            "ineligible",
            "personal consumption",
            "motor vehicle",
            "food and beverages",
        ],
        "source_file": "chapter_v_itc.txt",
    },
    {
        "rule_id": "RCM_S9_3",
        "category": "RCM",
        "title": "Reverse Charge Mechanism — Section 9(3)",
        "gst_section": "Section 9(3)",
        "gstr3b_table": "Table 3.1(d)",
        "keywords": [
            "rcm",
            "reverse charge",
            "section 9",
            "recipient",
            "specified categories",
        ],
        "source_file": "chapter_3_rcm.txt",
    },
    {
        "rule_id": "RCM_S9_4",
        "category": "RCM",
        "title": "RCM on Unregistered Supply — Section 9(4)",
        "gst_section": "Section 9(4)",
        "gstr3b_table": "Table 3.1(d)",
        "keywords": [
            "rcm",
            "reverse charge",
            "unregistered supplier",
            "section 9(4)",
        ],
        "source_file": "chapter_3_rcm.txt",
    },
    {
        "rule_id": "RETURN_FILING_S39",
        "category": "MATCHING",
        "title": "Return Filing Rules — Section 37, 38, 39",
        "gst_section": "Section 37/38/39",
        "gstr3b_table": "Table 4",
        "keywords": [
            "return filing",
            "section 37",
            "section 38",
            "section 39",
            "outward supplies",
            "inward supplies",
            "rectification",
            "annual return",
        ],
        "source_file": "section_37_38_39_returns.txt",
    },
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "rules"


def _read_source_file(filename: str) -> str:
    """Read a knowledge base text file."""
    path = DATA_DIR / filename
    return path.read_text(encoding="utf-8")


def _get_embedding(text: str) -> list[float]:
    """Generate embedding via OpenAI text-embedding-3-small.

    Returns an empty list if the API key is missing or the call fails.
    """
    try:
        from openai import OpenAI

        api_key = settings.OPENAI_API_KEY
        if not api_key or api_key.startswith("sk-your"):
            logger.warning("OpenAI API key not configured — skipping embedding generation.")
            return []

        client = OpenAI(api_key=api_key)
        # Truncate to 8000 tokens to stay within text-embedding-3-small limit (8191 tokens)
        try:
            import tiktoken

            enc = tiktoken.get_encoding("cl100k_base")
            tokens = enc.encode(text)
            if len(tokens) > 8000:
                text = enc.decode(tokens[:8000])
        except Exception:  # pylint: disable=broad-except
            text = text[:32000]  # ~8000 tokens as rough character fallback
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Embedding generation failed: %s — saving with empty embedding.", exc)
        return []


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

async def seed_rules() -> None:
    """Connect to MongoDB, generate embeddings, and upsert 5 ITC rules."""
    logger.info("Connecting to MongoDB...")
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=10,
        serverSelectionTimeoutMS=5000,
    )
    db = client.get_default_database()
    await init_beanie(database=db, document_models=[GstRule])
    logger.info("Connected. Seeding %d rules...", len(RULES_DATA))

    for rule_data in RULES_DATA:
        description = _read_source_file(rule_data["source_file"])
        embedding_input = rule_data["title"] + " " + description
        logger.info("Generating embedding for rule: %s", rule_data["rule_id"])
        embedding = _get_embedding(embedding_input)

        # Build the document fields
        fields = {
            "category": rule_data["category"],
            "title": rule_data["title"],
            "description": description,
            "keywords": rule_data["keywords"],
            "gst_section": rule_data["gst_section"],
            "gstr3b_table": rule_data["gstr3b_table"],
            "embedding": embedding,
            "is_active": True,
        }

        # Upsert: find by rule_id and update, or insert if not found
        existing = await GstRule.find_one(GstRule.rule_id == rule_data["rule_id"])
        if existing:
            await existing.set(fields)
            logger.info("Updated rule: %s", rule_data["rule_id"])
        else:
            rule = GstRule(rule_id=rule_data["rule_id"], **fields)
            await rule.insert()
            logger.info("Inserted rule: %s", rule_data["rule_id"])

    client.close()
    logger.info("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed_rules())
