"""
Chromium PDF backend (stub — requires playwright).

Install:
  pip install playwright
  playwright install chromium

Use this backend when WeasyPrint system dependencies (cairo, pango) are unavailable.
"""

from .base import PdfBackend


class ChromiumBackend(PdfBackend):
    def render(self, html: str, reconciliation=None) -> bytes:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise RuntimeError(
                "Playwright is not installed. Run: pip install playwright && playwright install chromium"
            ) from exc
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            pdf_bytes = page.pdf(
                format="A4",
                margin={"top": "2cm", "bottom": "2cm", "left": "2cm", "right": "2cm"},
            )
            browser.close()
            return pdf_bytes
