"""
Vector Service — Phase 6 RAG Document Ingestion.

Handles:
  - Text chunking (with configurable chunk size and overlap)
  - PDF text extraction via pypdf
    - Rule-document preprocessing for keyword-based retrieval
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


# Embedding generation has been removed. Keyword-based search is used instead.
