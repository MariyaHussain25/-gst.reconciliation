"""Abstract base class for PDF rendering backends."""

from abc import ABC, abstractmethod


class PdfBackend(ABC):
    @abstractmethod
    def render(self, html: str) -> bytes:
        """Render an HTML string to PDF bytes."""
