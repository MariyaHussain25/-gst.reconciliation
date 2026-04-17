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
        except (ImportError, OSError, Exception) as exc:
            raise RuntimeError(
                "WeasyPrint could not load required system libraries (Cairo/Pango/GObject). "
                "On Windows, install the GTK3 runtime: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer. "
                "On Linux: apt-get install libcairo2 libpango-1.0-0 libpangocairo-1.0-0. "
                f"Original error: {exc}"
            ) from exc
        try:
            return HTML(string=html).write_pdf()
        except OSError as exc:
            raise RuntimeError(
                f"WeasyPrint PDF rendering failed (system library error): {exc}"
            ) from exc
