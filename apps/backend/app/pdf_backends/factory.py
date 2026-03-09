"""
Factory that selects the PDF backend based on the PDF_BACKEND env variable.
Defaults to 'weasy'. Set PDF_BACKEND=chromium to switch.
"""

import os
from .base import PdfBackend


def get_pdf_backend() -> PdfBackend:
    backend = os.getenv("PDF_BACKEND", "weasy").lower()
    if backend == "weasy":
        from .weasy import WeasyPrintBackend
        return WeasyPrintBackend()
    elif backend == "chromium":
        from .chromium import ChromiumBackend
        return ChromiumBackend()
    else:
        raise ValueError(
            f"Unknown PDF_BACKEND: '{backend}'. Supported: 'weasy', 'chromium'."
        )
