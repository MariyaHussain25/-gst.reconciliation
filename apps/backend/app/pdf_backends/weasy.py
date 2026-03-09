"""
WeasyPrint PDF backend.

System dependencies required:
  - cairo
  - pango
  - gdk-pixbuf

Install on Ubuntu/Debian:
  apt-get install libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info

Install on macOS (Homebrew):
  brew install cairo pango gdk-pixbuf libffi

Install Python package:
  pip install weasyprint>=62.0

CI / Docker: see README.md#system-dependencies
"""

from .base import PdfBackend


class WeasyPrintBackend(PdfBackend):
    def render(self, html: str) -> bytes:
        try:
            from weasyprint import HTML
        except ImportError as exc:
            raise RuntimeError(
                "WeasyPrint is not installed. Run: pip install weasyprint>=62.0. "
                "System dependencies also required — see apps/backend/README.md."
            ) from exc
        return HTML(string=html).write_pdf()
