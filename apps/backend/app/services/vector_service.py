"""
Vector Service — Phase 6 RAG Document Ingestion.

Handles:
  - Text chunking (with configurable chunk size and overlap)
  - PDF text extraction via pypdf
  - OpenAI text-embedding-3-small vector generation (1536 dimensions)
"""

import logging
import re
from io import BytesIO

logger = logging.getLogger(__name__)

# Default chunking parameters
DEFAULT_CHUNK_SIZE = 500  # characters per chunk
DEFAULT_OVERLAP = 50  # character overlap between consecutive chunks


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> list[str]:
    """Split *text* into overlapping chunks of approximately *chunk_size* characters.

    Attempts to split on sentence boundaries ('. ', '! ', '? ') to preserve
    readability. Falls back to hard-splitting when no boundary is found within
    the current window.

    Args:
        text: The input text to chunk.
        chunk_size: Maximum characters per chunk.
        overlap: Characters of overlap between consecutive chunks.

    Returns:
        List of non-empty text chunks.
    """
    text = text.strip()
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end == len(text):
            chunks.append(text[start:].strip())
            break

        # Try to split on sentence boundary in the last 20 % of the window
        search_start = start + int(chunk_size * 0.8)
        boundary = None
        for m in re.finditer(r"(?<=[.!?])\s+", text[search_start:end]):
            boundary = search_start + m.start()

        if boundary:
            chunks.append(text[start:boundary].strip())
            start = max(boundary - overlap, start + 1)
        else:
            chunks.append(text[start:end].strip())
            start = max(end - overlap, start + 1)

    return [c for c in chunks if c]


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pypdf.

    Args:
        file_bytes: Raw bytes of the PDF file.

    Returns:
        Concatenated text extracted from all pages.

    Raises:
        RuntimeError: If pypdf is not installed or extraction fails.
    """
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(BytesIO(file_bytes))
        pages: list[str] = []
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                pages.append(extracted)
        return "\n\n".join(pages)
    except ImportError:
        logger.error("[vector_service] pypdf is not installed. Cannot parse PDFs.")
        raise RuntimeError(
            "pypdf package is required for PDF parsing. Run: pip install pypdf"
        )
    except Exception as exc:
        logger.error("[vector_service] PDF extraction failed: %s", exc)
        raise RuntimeError(f"Failed to extract text from PDF: {exc}") from exc


def get_openai_embedding(text: str) -> list[float]:
    """Generate a 1536-dimensional embedding vector using OpenAI text-embedding-3-small.

    Args:
        text: The text to embed (will be truncated to the model's token limit).

    Returns:
        List of 1536 floats, or an empty list if embedding fails.
    """
    from app.config.settings import settings

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("[vector_service] OPENAI_API_KEY is not set. Cannot generate embeddings.")
        return []

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)
        # Normalize whitespace and truncate to avoid token-limit errors
        clean_text = " ".join(text.split())[:8191]

        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=clean_text,
        )
        return response.data[0].embedding
    except ImportError:
        logger.error("[vector_service] openai package is not installed.")
        return []
    except Exception as exc:
        logger.error("[vector_service] OpenAI embedding failed: %s", exc)
        return []


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    """Return an embedding vector for each chunk.

    Chunks that fail to embed receive an empty list placeholder so the index
    of each embedding always corresponds to the same index in *chunks*.

    Args:
        chunks: List of text chunks to embed.

    Returns:
        Parallel list of embedding vectors (or empty lists on failure).
    """
    embeddings: list[list[float]] = []
    for i, chunk in enumerate(chunks):
        vec = get_openai_embedding(chunk)
        if not vec:
            logger.warning("[vector_service] Empty embedding for chunk index %d.", i)
        embeddings.append(vec)
    return embeddings
