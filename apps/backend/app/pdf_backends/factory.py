"""
Factory that selects the PDF backend based on the PDF_BACKEND env variable.
Defaults to 'weasy'. Set PDF_BACKEND=chromium to switch.
"""

from .base import PdfBackend
from app.config.settings import settings


def get_pdf_backend(name: str | None = None) -> PdfBackend:
    backend = (name or settings.PDF_BACKEND or "weasy").lower()
    if backend == "weasy":
        from .weasy import WeasyPrintBackend
        return WeasyPrintBackend()
    elif backend == "chromium":
        from .chromium import ChromiumBackend
        return ChromiumBackend()
    elif backend == "reportlab":
        from .reportlab import ReportLabBackend
        return ReportLabBackend()
    else:
        raise ValueError(
            f"Unknown PDF_BACKEND: '{backend}'. Supported: 'weasy', 'chromium', 'reportlab'."
        )
