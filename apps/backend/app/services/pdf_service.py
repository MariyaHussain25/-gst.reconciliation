"""
PDF HTML template builder and rendering service.

Generates an HTML string for a GST Reconciliation report and delegates
PDF rendering to the configured backend (WeasyPrint or Chromium).
"""

from datetime import datetime, timezone
from typing import Optional

from app.models.reconciliation import Reconciliation
from app.pdf_backends.factory import get_pdf_backend


# ── Indian currency formatter (₹1,23,456.78) ─────────────────────────────────

def _fmt_inr(amount: Optional[float]) -> str:
    if amount is None:
        return "—"
    is_negative = amount < 0
    val         = abs(amount)
    int_part    = int(val)
    dec_part    = round((val - int_part) * 100)
    s           = str(int_part)
    if len(s) > 3:
        result = s[-3:]
        s      = s[:-3]
        while len(s) > 2:
            result = s[-2:] + "," + result
            s      = s[:-2]
        result = s + "," + result
    else:
        result = s
    formatted = f"₹{result}.{dec_part:02d}"
    return f"-{formatted}" if is_negative else formatted


# ── Badge colours ─────────────────────────────────────────────────────────────

_BADGE_COLOURS: dict[str, str] = {
    "EXACT_MATCH":      "#278556",
    "FUZZY_MATCH":      "#f09517",
    "MISMATCH":         "#e67e22",
    "NEEDS_REVIEW":     "#4470b0",
    "MISSING_IN_2B":    "#db2525",
    "MISSING_IN_BOOKS": "#db2525",
    "MISSING_IN_2A":    "#db2525",
    "UNMATCHED":        "#db2525",
}


def _badge(status: str) -> str:
    colour = _BADGE_COLOURS.get(status, "#6e7175")
    label  = status.replace("_", " ")
    return (
        f'<span style="background:{colour};color:#fff;border-radius:3px;'
        f'padding:2px 6px;font-size:9pt;white-space:nowrap;">{label}</span>'
    )


def _invoice_ref(r) -> str:
    """
    Return the best available invoice reference for display in the PDF.
    Priority: GSTR-2B invoice number → GSTR-2A official invoice number
              → GSTR-2A vch_no → fallback dash.
    """
    return (
        r.gstr2b_invoice_number
        or getattr(r, "gstr2a_invoice_number", None)
        or r.gstr2a_vch_no
        or "—"
    )


# ── HTML builder ──────────────────────────────────────────────────────────────

def build_html(reconciliation: Reconciliation, generated_at: datetime) -> str:
    generated_str = generated_at.strftime("%d %b %Y %H:%M UTC")
    period = reconciliation.period
    fy     = reconciliation.financial_year
    user_id= reconciliation.user_id
    status = reconciliation.status
    s      = reconciliation.summary

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
        + _row("Total Invoices",  str(s.total_invoices))
        + _row("Exact Matched",   str(s.matched_count))
        + _row("Fuzzy Match",     str(s.fuzzy_match_count))
        + _row("Value Mismatches",str(s.value_mismatch_count))
        + "</table></div>"
    )
    card2 = (
        f'<div {card_style}><table style="width:100%;border-collapse:collapse;">'
        + _row("Missing in 2B",   str(s.missing_in_2b_count))
        + _row("Missing in Books",str(s.missing_in_2a_count))
        + _row("GSTIN Mismatches",str(s.gstin_mismatch_count))
        + _row("Needs Review",    str(s.needs_review_count))
        + "</table></div>"
    )
    card3 = (
        f'<div {card_style}><table style="width:100%;border-collapse:collapse;">'
        + _row("Total Eligible ITC",  _fmt_inr(s.total_eligible_itc))
        + _row("Total Blocked ITC",   _fmt_inr(s.total_blocked_itc))
        + _row("Total Ineligible ITC",_fmt_inr(s.total_ineligible_itc))
        + "</table></div>"
    )

    def _tax_total(r) -> float:
        if r.gstr2b_igst is not None or r.gstr2b_cgst is not None or r.gstr2b_sgst is not None:
            return round(
                (r.gstr2b_igst or 0.0) + (r.gstr2b_cgst or 0.0) + (r.gstr2b_sgst or 0.0), 2
            )
        return round(
            (r.gstr2a_igst or 0.0) + (r.gstr2a_cgst or 0.0) + (r.gstr2a_sgst or 0.0), 2
        )

    # Report 1: rows that need accountant attention
    report_rows = [
        r for r in reconciliation.results
        if r.match_status in {
            "MISSING_IN_2B", "MISSING_IN_BOOKS", "MISSING_IN_2A",
            "FUZZY_MATCH", "MISMATCH", "NEEDS_REVIEW",
        }
    ]

    if report_rows:
        rows_html = ""
        for i, r in enumerate(report_rows):
            bg = "#ffffff" if i % 2 == 0 else "#f5f4f2"
            gstin   = r.gstr2a_vendor_gstin or r.gstr2b_vendor_gstin or "—"
            vendor  = r.gstr2b_vendor_name or r.gstr2a_vendor_name or "—"
            inv_ref = _invoice_ref(r)
            expl    = r.ai_explanation or r.mismatch_reason or "Review required."
            rows_html += (
                f'<tr style="background:{bg};">'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{i + 1}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{_badge(r.match_status)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;font-family:monospace;font-size:8pt;">{gstin}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{vendor}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{inv_ref}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.gstr2a_invoice_amount)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(r.gstr2b_invoice_value)}</td>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #eeede9;">{expl}</td>'
                f"</tr>"
            )
    else:
        rows_html = (
            '<tr><td colspan="8" style="padding:20px;text-align:center;'
            'color:#6e7175;font-style:italic;">'
            'All invoices matched exactly — no discrepancies to report.'
            "</td></tr>"
        )

    matched_statuses = {"EXACT_MATCH", "FUZZY_MATCH"}
    missing_statuses = {"MISSING_IN_2B", "MISSING_IN_BOOKS", "MISSING_IN_2A"}

    table_4a = round(sum(_tax_total(r) for r in reconciliation.results if r.match_status in matched_statuses), 2)
    table_4b = round(sum(_tax_total(r) for r in reconciliation.results if r.match_status in missing_statuses), 2)
    table_4c = round(table_4a - table_4b, 2)

    th = (
        'style="padding:8px;background:#182844;color:#fff;text-align:left;'
        'font-weight:600;font-size:8.5pt;white-space:nowrap;"'
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>GST Reconciliation Report — {period}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&display=swap');
:root {{
  --primary: #182844;
  --success: #278556;
  --muted: #eeede9;
  --foreground: #191d26;
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
* {{ box-sizing: border-box; }}
body {{
  font-family: 'Noto Sans', sans-serif;
  font-size: 10pt;
  color: var(--foreground);
  background: #fff;
  margin: 0; padding: 0;
}}
.header-bar {{
  background: var(--primary);
  color: #fff;
  padding: 20px 24px;
  margin-bottom: 20px;
  border-radius: 4px;
}}
.header-bar h1 {{ margin: 0 0 6px 0; font-size: 18pt; font-weight: 700; }}
.header-meta {{ font-size: 9pt; opacity: 0.85; display: flex; gap: 16px; flex-wrap: wrap; }}
.section-title {{
  font-size: 12pt; font-weight: 600; color: var(--primary);
  margin: 20px 0 10px 0;
  border-bottom: 2px solid var(--primary);
  padding-bottom: 4px;
}}
.cards-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }}
table.results {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 8px; }}
table.results th {{ padding: 8px; background: var(--primary); color: #fff; text-align: left; font-weight: 600; font-size: 8.5pt; white-space: nowrap; }}
table.results td {{ padding: 5px 8px; border-bottom: 1px solid var(--muted); vertical-align: top; }}
</style>
</head>
<body>

<div class="header-bar">
  <h1>GST Reconciliation Report</h1>
  <div class="header-meta">
    <span>User: {user_id}</span>
    <span>Period: {period}</span>
    <span>FY: {fy}</span>
    <span>Status: {status}</span>
    <span>Generated: {generated_str}</span>
  </div>
</div>

<div class="section-title">Summary</div>
<div class="cards-grid">{card1}{card2}{card3}</div>

<div class="section-title">Reconciliation Report — Accountant View</div>
<table class="results">
  <thead>
    <tr>
      <th {th}>#</th>
      <th {th}>Status</th>
      <th {th}>GSTIN</th>
      <th {th}>Vendor</th>
      <th {th}>Invoice No.</th>
      <th {th}>2A Value</th>
      <th {th}>2B Value</th>
      <th {th}>AI Explanation</th>
    </tr>
  </thead>
  <tbody>{rows_html}</tbody>
</table>

<div class="section-title">GST-Ready Summary — Portal View (GSTR-3B)</div>
<table class="results" style="max-width:520px;">
  <thead>
    <tr>
      <th {th}>GSTR-3B Table</th>
      <th {th}>Description</th>
      <th {th}>Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eeede9;">4(A)</td>
      <td style="padding:8px;border-bottom:1px solid #eeede9;">ITC Available (Matched invoices)</td>
      <td style="padding:8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(table_4a)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eeede9;">4(B)</td>
      <td style="padding:8px;border-bottom:1px solid #eeede9;">ITC Reversed (Missing invoices)</td>
      <td style="padding:8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(table_4b)}</td>
    </tr>
    <tr style="font-weight:700;">
      <td style="padding:8px;border-bottom:1px solid #eeede9;">4(C)</td>
      <td style="padding:8px;border-bottom:1px solid #eeede9;">Net ITC Available</td>
      <td style="padding:8px;border-bottom:1px solid #eeede9;text-align:right;">{_fmt_inr(table_4c)}</td>
    </tr>
  </tbody>
</table>

</body>
</html>"""

    return html


def generate_pdf(reconciliation: Reconciliation) -> bytes:
    """Build HTML and render to PDF bytes using the configured backend."""
    html    = build_html(reconciliation, datetime.now(timezone.utc))
    backend = get_pdf_backend()
    try:
        return backend.render(html, reconciliation)
    except RuntimeError as primary_exc:
        if backend.__class__.__name__ == "ReportLabBackend":
            raise
        fallback = get_pdf_backend("reportlab")
        try:
            return fallback.render(html, reconciliation)
        except RuntimeError as fallback_exc:
            raise RuntimeError(
                f"Primary PDF backend failed: {primary_exc}. "
                f"Fallback also failed: {fallback_exc}"
            ) from fallback_exc