"""PDF generation service using WeasyPrint.

Generates a styled GST Reconciliation PDF from a Reconciliation document.
"""

from datetime import datetime, timezone

try:
    from weasyprint import HTML as WeasyHTML

    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False

from app.models.reconciliation import Reconciliation

# Colour constants matching design tokens
_COLOR_PRIMARY = "#182844"
_COLOR_SUCCESS = "#278556"
_COLOR_WARNING = "#f09517"
_COLOR_DESTRUCTIVE = "#db2525"
_COLOR_INFO = "#4470b0"
_COLOR_MUTED = "#eeede9"
_COLOR_ROW_ALT = "#f5f4f2"

# Match status → CSS colour
_MATCH_STATUS_COLORS: dict[str, str] = {
    "EXACT_MATCH": _COLOR_SUCCESS,
    "FUZZY_MATCH": _COLOR_WARNING,
    "NEEDS_REVIEW": _COLOR_INFO,
    "MISSING_IN_2B": _COLOR_DESTRUCTIVE,
    "MISSING_IN_BOOKS": _COLOR_DESTRUCTIVE,
    "UNMATCHED": _COLOR_DESTRUCTIVE,
}


def _fmt(value: float | None) -> str:
    """Format a float as Indian currency string."""
    if value is None:
        return "—"
    return f"₹{value:,.2f}"


def _status_badge(status: str) -> str:
    """Return an inline HTML badge for the given match status."""
    color = _MATCH_STATUS_COLORS.get(status, _COLOR_MUTED)
    label = status.replace("_", " ").title()
    return (
        f'<span style="background:{color};color:#fff;'
        f'padding:2px 7px;border-radius:4px;font-size:10px;'
        f'font-weight:600;white-space:nowrap;">{label}</span>'
    )


def _build_html(reconciliation: Reconciliation, generated_at: str) -> str:
    """Build the full HTML string for the PDF report."""
    s = reconciliation.summary

    # Summary statistics rows
    summary_rows = [
        ("Total Invoices", s.total_invoices),
        ("Matched", s.matched_count),
        ("Fuzzy Match", s.fuzzy_match_count),
        ("Needs Review", s.needs_review_count),
        ("Missing in 2A", s.missing_in_2a_count),
        ("Missing in Books (2B)", s.missing_in_2b_count),
        ("Value Mismatches", s.value_mismatch_count),
        ("GSTIN Mismatches", s.gstin_mismatch_count),
        ("Total Eligible ITC", _fmt(s.total_eligible_itc)),
        ("Total Blocked ITC", _fmt(s.total_blocked_itc)),
        ("Total Ineligible ITC", _fmt(s.total_ineligible_itc)),
    ]

    summary_html = "".join(
        f'<tr style="background:{"#fff" if i % 2 == 0 else _COLOR_ROW_ALT};">'
        f'<td style="padding:6px 12px;font-weight:500;">{label}</td>'
        f'<td style="padding:6px 12px;text-align:right;">{value}</td>'
        f"</tr>"
        for i, (label, value) in enumerate(summary_rows)
    )

    # Detailed results table rows
    detail_rows_html = ""
    for idx, r in enumerate(reconciliation.results):
        bg = "#fff" if idx % 2 == 0 else _COLOR_ROW_ALT
        detail_rows_html += (
            f'<tr style="background:{bg};">'
            f'<td style="padding:5px 8px;text-align:center;">{idx + 1}</td>'
            f'<td style="padding:5px 8px;">{_status_badge(r.match_status)}</td>'
            f'<td style="padding:5px 8px;">{r.gstr2a_vendor_name or "—"}</td>'
            f'<td style="padding:5px 8px;">{r.gstr2b_vendor_name or "—"}</td>'
            f'<td style="padding:5px 8px;">{r.gstr2b_invoice_number or "—"}</td>'
            f'<td style="padding:5px 8px;text-align:right;">{_fmt(r.total_amount_diff)}</td>'
            f'<td style="padding:5px 8px;text-align:right;">{_fmt(r.taxable_amount_diff)}</td>'
            f'<td style="padding:5px 8px;text-align:right;">{_fmt(r.igst_diff)}</td>'
            f'<td style="padding:5px 8px;text-align:right;">{_fmt(r.cgst_diff)}</td>'
            f'<td style="padding:5px 8px;text-align:right;">{_fmt(r.sgst_diff)}</td>'
            f'<td style="padding:5px 8px;">{r.itc_category}</td>'
            f'<td style="padding:5px 8px;">{r.itc_availability}</td>'
            f"</tr>"
        )

    detail_header_style = (
        f"background:{_COLOR_PRIMARY};color:#fff;"
        f"padding:7px 8px;text-align:left;font-size:11px;font-weight:600;"
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');
*, *::before, *::after {{ box-sizing: border-box; }}
@page {{
  size: A4 landscape;
  margin: 2cm;
  @bottom-center {{
    content: "Page " counter(page) " of " counter(pages) "  ·  Generated: {generated_at}";
    font-family: 'Noto Sans', sans-serif;
    font-size: 9px;
    color: #888;
  }}
}}
body {{
  font-family: 'Noto Sans', sans-serif;
  font-size: 12px;
  color: #222;
  margin: 0;
  padding: 0;
}}
h1, h2 {{ margin: 0; padding: 0; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ font-size: 11px; }}
</style>
</head>
<body>

<!-- ── Report Header ── -->
<div style="background:{_COLOR_PRIMARY};color:#fff;padding:16px 20px;border-radius:6px 6px 0 0;margin-bottom:0;">
  <h1 style="font-size:20px;font-weight:700;letter-spacing:0.5px;">GST Reconciliation Report</h1>
  <p style="margin-top:4px;font-size:12px;color:#a4aab4;">
    Generated: {generated_at}
  </p>
</div>

<!-- ── Section A: Metadata + Summary ── -->
<div style="background:#fff;border:1px solid #dddbd7;border-top:none;padding:16px 20px;margin-bottom:16px;border-radius:0 0 6px 6px;">

  <table style="width:100%;margin-bottom:16px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:16px;">
        <table style="width:100%;border:1px solid #dddbd7;border-radius:4px;overflow:hidden;">
          <thead>
            <tr style="background:{_COLOR_PRIMARY};color:#fff;">
              <th colspan="2" style="padding:7px 12px;text-align:left;font-size:12px;">Report Metadata</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#fff;">
              <td style="padding:6px 12px;font-weight:500;width:50%;">User / GSTIN</td>
              <td style="padding:6px 12px;">{reconciliation.user_id}</td>
            </tr>
            <tr style="background:{_COLOR_ROW_ALT};">
              <td style="padding:6px 12px;font-weight:500;">Period</td>
              <td style="padding:6px 12px;">{reconciliation.period}</td>
            </tr>
            <tr style="background:#fff;">
              <td style="padding:6px 12px;font-weight:500;">Financial Year</td>
              <td style="padding:6px 12px;">{reconciliation.financial_year}</td>
            </tr>
            <tr style="background:{_COLOR_ROW_ALT};">
              <td style="padding:6px 12px;font-weight:500;">Status</td>
              <td style="padding:6px 12px;">{reconciliation.status}</td>
            </tr>
          </tbody>
        </table>
      </td>
      <td style="width:50%;vertical-align:top;">
        <table style="width:100%;border:1px solid #dddbd7;border-radius:4px;overflow:hidden;">
          <thead>
            <tr style="background:{_COLOR_PRIMARY};color:#fff;">
              <th colspan="2" style="padding:7px 12px;text-align:left;font-size:12px;">Summary Statistics</th>
            </tr>
          </thead>
          <tbody>
            {summary_html}
          </tbody>
        </table>
      </td>
    </tr>
  </table>

</div>

<!-- ── Section B: Detailed Results ── -->
<div style="margin-top:8px;">
  <div style="background:{_COLOR_PRIMARY};color:#fff;padding:8px 12px;border-radius:4px 4px 0 0;">
    <h2 style="font-size:13px;font-weight:700;">Detailed Results ({len(reconciliation.results)} records)</h2>
  </div>
  <div style="overflow:hidden;border:1px solid #dddbd7;border-top:none;border-radius:0 0 4px 4px;">
    <table>
      <thead>
        <tr>
          <th style="{detail_header_style}text-align:center;">#</th>
          <th style="{detail_header_style}">Match Status</th>
          <th style="{detail_header_style}">GSTR-2A Vendor</th>
          <th style="{detail_header_style}">GSTR-2B Vendor</th>
          <th style="{detail_header_style}">Invoice No.</th>
          <th style="{detail_header_style}text-align:right;">Total Diff (₹)</th>
          <th style="{detail_header_style}text-align:right;">Taxable Diff (₹)</th>
          <th style="{detail_header_style}text-align:right;">IGST Diff (₹)</th>
          <th style="{detail_header_style}text-align:right;">CGST Diff (₹)</th>
          <th style="{detail_header_style}text-align:right;">SGST Diff (₹)</th>
          <th style="{detail_header_style}">ITC Category</th>
          <th style="{detail_header_style}">ITC Avail.</th>
        </tr>
      </thead>
      <tbody>
        {detail_rows_html if detail_rows_html else
         f'<tr><td colspan="12" style="padding:16px;text-align:center;color:#888;">No results recorded.</td></tr>'}
      </tbody>
    </table>
  </div>
</div>

</body>
</html>"""


def generate_pdf(reconciliation: Reconciliation) -> bytes:
    """Generate a PDF report for the given Reconciliation document.

    Args:
        reconciliation: The Reconciliation Beanie document to render.

    Returns:
        Raw PDF bytes.

    Raises:
        RuntimeError: If WeasyPrint is not installed.
    """
    if not WEASYPRINT_AVAILABLE:
        raise RuntimeError(
            "WeasyPrint is not installed. "
            "Install it with: pip install weasyprint>=62.0"
        )

    generated_at = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    html_content = _build_html(reconciliation, generated_at)
    pdf_bytes: bytes = WeasyHTML(string=html_content).write_pdf()
    return pdf_bytes
