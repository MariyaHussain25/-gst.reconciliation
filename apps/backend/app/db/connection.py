"""
MongoDB connection using Motor (async driver) and Beanie (async ODM).
Establishes connection to MongoDB Atlas and initializes all Beanie document models.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config.settings import settings
from app.models.user import User
from app.models.gstr2a import Gstr2ARecord
from app.models.gstr2b import Gstr2BRecord
from app.models.invoice import Invoice
from app.models.reconciliation import Reconciliation
from app.models.gst_rule import GstRule
from app.models.pdf_job import PdfJob

_client: AsyncIOMotorClient | None = None


def mask_gstin(gstin: str) -> str:
    """Mask GSTIN for safe logging: 36XXXX...1ZX"""
    if len(gstin) < 6:
        return "***"
    return f"{gstin[:2]}XXXX...{gstin[-3:]}"


async def connect_db() -> None:
    """Connect to MongoDB Atlas and initialize Beanie ODM."""
    global _client
    print("[DB] Connecting to MongoDB Atlas...")
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=10,
        serverSelectionTimeoutMS=5000,
    )
    db = _client.get_default_database()
    await init_beanie(
        database=db,
        document_models=[
            User,
            Gstr2ARecord,
            Gstr2BRecord,
            Invoice,
            Reconciliation,
            GstRule,
            PdfJob,
        ],
    )
    print("[DB] Successfully connected to MongoDB Atlas")


async def disconnect_db() -> None:
    """Close the MongoDB connection gracefully."""
    global _client
    if _client:
        _client.close()
        _client = None
        print("[DB] Disconnected from MongoDB")
