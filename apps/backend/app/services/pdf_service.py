"""
PDF HTML template builder and rendering service.

Generates an HTML string for a GST Reconciliation report and delegates
PDF rendering to the configured backend (WeasyPrint or Chromium).
"""

from datetime import datetime, timezone
from typing import Optional

from app.models.reconciliation import Reconciliation
from app.pdf_backends.factory import get_pdf_backend


# ---------------------------------------------------------------------------
# Indian currency formatter (₹1,23,456.78)
# ---------------------------------------------------------------------------

def _fmt_inr(amount: Optional[float]) -> str:
    """Format a number as Indian Rupee currency string."""
    if amount is None:
        return "—"
    # Use Python's locale-independent approach for Indian number formatting
    is_negative = amount < 0
    val = abs(amount)
    # Split into integer and decimal parts
    int_part = int(val)
    dec_part = round((val - int_part) * 100)
    s = str(int_part)
    # Indian grouping: last 3 digits, then groups of 2
    if len(s) > 3:
        result = s[-3:]
        s = s[:-3]
        while len(s) > 2:
            result = s[-2:] + "," + result
            s = s[:-2]
        result = s + "," + result
    else:
        result = s
    formatted = f"₹{result}.{dec_part:02d}"
    return f"-{formatted}" if is_negative else formatted


# ---------------------------------------------------------------------------
# Match-status badge colours
# ---------------------------------------------------------------------------

_BADGE_COLOURS: dict[str, str] = {
    # Engine emits these:
    "MATCHED": "#278556",           # green
    "FUZZY_MATCHED": "#f09517",     # amber
    "NEEDS_REVIEW": "#4470b0",      # blue
    "VALUE_MISMATCH": "#db2525",    # red
    "GSTIN_MISMATCH": "#db2525",    # red
    "MISSING_IN_2B": "#db2525",     # red
    "MISSING_IN_BOOKS": "#db2525",  # red
    "UNMATCHED": "#db2525",         # red
}


def _badge(status: str) -> str:
    colour = _BADGE_COLOURS.get(status, "#6e7175")
    return (
        f'<span style="background:{colour};color:#fff;border-radius:3px;'
        f'padding:2px 6px;font-size:9pt;white-space:nowrap;">{status}</span>'
    )


# ---------------------------------------------------------------------------
# HTML builder
# ---------------------------------------------------------------------------

def build_html(reconciliation: Reconciliation, generated_at: datetime) -> str:
    """Build the full HTML string for the PDF report."""
    generated_str = generated_at.strftime("%d %b %Y %H:%M UTC")
    period = reconciliation.period
    fy = reconciliation.financial_year
    user_id = reconciliation.user_id
    status = reconciliation.status
    s = reconciliation.summary

    # Summary cards
    card_style = (
        'style="background:#fff;border:1px solid #dddbd7;border-radius:6px;'
        'padding:16px 20px;margin-bottom:12px;"'
    )

    def _row(label: str, value: str) -> str:
        return (
            f'<tr><td style="padding:3px 0;color:#6e7175;font-size:10pt;">{label}</td>'
            f'<td style="padding:3px 0 3px 12px;font-weight:600;font-size:10pt;'
            f'text-align:right;">{value}</td></tr>'
        )

    card1 = (
        f'<div {card_style}><table style="width:100%;border-collapse:collapse;">'
        + _row("Total Invoices", str(s.total_invoices))
        + _row("Matched", str(s.matched_count))
        + _row("Fuzzy Match", str(s.fuzzy_match_count))
        + _row("Needs Review", str(s.needs_review_count))
        + "</table></div>"
    )
    card2 = (
        f'<div {card_style}><table style="width:100%;border-collapse:collapse;">'
        + _row("Missing in 2A", str(s.missing_in_2a_count))
        + _row("Missing in Books", str(s.missing_in_2b_count))
        + _row("Value Mismatches", str(s.value_mismatch_count))
        + _row("GSTIN Mismatches", str(s.gstin_mismatch_count))
        + "</table></div>"
    )
    card3 = (
        f'<div {card_style}><table style="width:100%;border-collapse:collapse;">'
        + _row("Total Eligible ITC", _fmt_inr(s.total_eligible_itc))
        + _row("Total Blocked ITC", _fmt_inr(s.total_blocked_itc))
        + _row("Total Ineligible ITC", _fmt_inr(s.total_ineligible_itc))
        + "</table></div>"
    )

    # Results table rows
    if reconciliation.results:
        rows_html = ""
        for i, r in enumerate(reconciliation.results):
            bg = "#ffffff" if i % 2 == 0 else "#f5f4f2"
            rows_html += (
                f'<tr style="background:{bg};">'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{i + 1}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{_badge(r.match_status)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{r.gstr2a_vendor_name or "—"}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{r.gstr2b_vendor_name or "—"}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{r.gstr2b_invoice_number or "—"}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.total_amount_diff)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.taxable_amount_diff)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.igst_diff)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.cgst_diff)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.sgst_diff)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{r.itc_category}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{r.itc_availability}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;max-width:280px;">{(r.ai_explanation or "—").replace("<", "&lt;").replace(">", "&gt;")}</td>'
                f"</tr>"
            )
    else:
        rows_html = (
            '<tr><td colspan="13" style="padding:20px;text-align:center;'
            'color:#6e7175;font-style:italic;">No reconciliation results found.</td></tr>'
        )

    th_style = (
        'style="padding:8px;background:#182844;color:#fff;text-align:left;'
        'font-weight:600;font-size:9pt;white-space:nowrap;"'
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>GST Reconciliation Report — {period}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&display=swap');

:root {{
  --primary: #182844;
  --success: #278556;
  --warning: #f09517;
  --destructive: #db2525;
  --accent: #917260;
  --info: #4470b0;
  --background: #f5f4f2;
  --foreground: #191d26;
  --muted: #eeede9;
}}

@page {{
  size: A4;
  margin: 2cm;
  @bottom-center {{
    content: "Page " counter(page) " of " counter(pages) " · Generated {generated_str}";
    font-size: 9pt;
    color: #6e7175;
  }}
}}

* {{
  box-sizing: border-box;
}}

body {{
  font-family: 'Noto Sans', sans-serif;
  font-size: 10pt;
  color: var(--foreground);
  background: #fff;
  margin: 0;
  padding: 0;
}}

.header-bar {{
  background: var(--primary);
  color: #fff;
  padding: 20px 24px;
  margin-bottom: 20px;
  border-radius: 4px;
}}

.header-bar h1 {{
  margin: 0 0 6px 0;
  font-size: 18pt;
  font-weight: 700;
}}

.header-meta {{
  font-size: 9pt;
  opacity: 0.85;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}}

.section-title {{
  font-size: 12pt;
  font-weight: 600;
  color: var(--primary);
  margin: 20px 0 10px 0;
  border-bottom: 2px solid var(--primary);
  padding-bottom: 4px;
}}

.cards-grid {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}}

table.results {{
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin-top: 8px;
}}

table.results th {{
  padding: 8px;
  background: var(--primary);
  color: #fff;
  text-align: left;
  font-weight: 600;
  font-size: 8.5pt;
  white-space: nowrap;
}}

table.results td {{
  padding: 5px 8px;
  border-bottom: 1px solid var(--muted);
  vertical-align: top;
}}
</style>
</head>
<body>

<!-- Section A: Header + Summary -->
<div class="header-bar">
  <h1>GST Reconciliation Report</h1>
  <div class="header-meta">
    <span>User ID: {user_id}</span>
    <span>Period: {period}</span>
    <span>FY: {fy}</span>
    <span>Status: {status}</span>
    <span>Generated: {generated_str}</span>
  </div>
</div>

<div class="section-title">Summary</div>
<div class="cards-grid">
  {card1}
  {card2}
  {card3}
</div>

<!-- Section B: Results Table -->
<div class="section-title">Reconciliation Results</div>
<table class="results">
  <thead>
    <tr>
      <th {th_style}>#</th>
      <th {th_style}>Match Status</th>
      <th {th_style}>GSTR-2A Vendor</th>
      <th {th_style}>GSTR-2B Vendor</th>
      <th {th_style}>Invoice No.</th>
      <th {th_style}>Total Diff (₹)</th>
      <th {th_style}>Taxable Diff (₹)</th>
      <th {th_style}>IGST Diff</th>
      <th {th_style}>CGST Diff</th>
      <th {th_style}>SGST Diff</th>
      <th {th_style}>ITC Category</th>
      <th {th_style}>ITC Availability</th>
      <th {th_style}>AI Explanation</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
  </tbody>
</table>

</body>
</html>"""

    return html


def generate_pdf(reconciliation: Reconciliation) -> bytes:
    """Build HTML and render to PDF bytes using the configured backend."""
    html = build_html(reconciliation, datetime.now(timezone.utc))
    backend = get_pdf_backend()
    return backend.render(html)
