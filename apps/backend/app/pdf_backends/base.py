"""Abstract base class for PDF rendering backends."""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.reconciliation import Reconciliation


class PdfBackend(ABC):
    @abstractmethod
    def render(self, html: str, reconciliation: "Reconciliation | None" = None) -> bytes:
        """Render an HTML string to PDF bytes."""
