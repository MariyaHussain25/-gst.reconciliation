"""
ReportLab PDF backend.

Pure-Python fallback renderer used when HTML-based engines like WeasyPrint
or Playwright/Chromium are unavailable on the host machine.
"""

from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.reconciliation import Reconciliation

from .base import PdfBackend


def _fmt_inr(amount: float | None) -> str:
    if amount is None:
        return "-"
    is_negative = amount < 0
    val = abs(amount)
    int_part = int(val)
    dec_part = round((val - int_part) * 100)
    s = str(int_part)
    if len(s) > 3:
        result = s[-3:]
        s = s[:-3]
        while len(s) > 2:
            result = s[-2:] + "," + result
            s = s[:-2]
        result = s + "," + result
    else:
        result = s
    formatted = f"Rs. {result}.{dec_part:02d}"
    return f"-{formatted}" if is_negative else formatted


class ReportLabBackend(PdfBackend):
    def render(self, html: str, reconciliation: Reconciliation | None = None) -> bytes:
        if reconciliation is None:
            raise RuntimeError("ReportLab backend requires reconciliation data.")

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=14 * mm,
            bottomMargin=16 * mm,
            title=f"GST Reconciliation Report - {reconciliation.period}",
        )

        styles = getSampleStyleSheet()
        title_style = styles["Title"]
        heading_style = styles["Heading2"]
        body_style = styles["BodyText"]
        small_style = ParagraphStyle(
            "SmallBody",
            parent=body_style,
            fontSize=8,
            leading=10,
            spaceAfter=2,
        )
        right_style = ParagraphStyle("RightBody", parent=small_style, alignment=TA_RIGHT)

        story = []
        generated_at = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
        summary = reconciliation.summary

        story.append(Paragraph("GST Reconciliation Report", title_style))
        story.append(
            Paragraph(
                f"User ID: {reconciliation.user_id} | Period: {reconciliation.period} | "
                f"FY: {reconciliation.financial_year} | Status: {reconciliation.status} | Generated: {generated_at}",
                small_style,
            )
        )
        story.append(Spacer(1, 10))

        story.append(Paragraph("Summary", heading_style))
        summary_rows = [
            ["Total Invoices", str(summary.total_invoices), "Matched", str(summary.matched_count)],
            ["Fuzzy Match", str(summary.fuzzy_match_count), "Needs Review", str(summary.needs_review_count)],
            ["Missing in 2A", str(summary.missing_in_2a_count), "Missing in 2B", str(summary.missing_in_2b_count)],
            ["Value Mismatch", str(summary.value_mismatch_count), "GSTIN Mismatch", str(summary.gstin_mismatch_count)],
            ["Eligible ITC", _fmt_inr(summary.total_eligible_itc), "Blocked ITC", _fmt_inr(summary.total_blocked_itc)],
            ["Ineligible ITC", _fmt_inr(summary.total_ineligible_itc), "", ""],
        ]
        summary_table = Table(summary_rows, colWidths=[36 * mm, 40 * mm, 36 * mm, 40 * mm])
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d5d5d5")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("ALIGN", (3, 0), (3, -1), "RIGHT"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(summary_table)
        story.append(Spacer(1, 10))

        story.append(Paragraph("Report 1: Reconciliation Report (Accountant View)", heading_style))
        result_rows = [[
            Paragraph("Status", small_style),
            Paragraph("GSTIN", small_style),
            Paragraph("Invoice No.", small_style),
            Paragraph("Books Value", right_style),
            Paragraph("2B Value", right_style),
            Paragraph("Reason / Explanation", small_style),
        ]]

        filtered_results = [
            result
            for result in reconciliation.results
            if result.match_status in {"MISSING_IN_2B", "MISSING_IN_BOOKS", "FUZZY_MATCH"}
        ]
        if not filtered_results:
            filtered_results = reconciliation.results[:50]

        for result in filtered_results:
            reason = result.ai_explanation or result.mismatch_reason or "Review required."
            result_rows.append(
                [
                    Paragraph(result.match_status.replace("_", " "), small_style),
                    Paragraph(result.gstr2a_vendor_gstin or result.gstr2b_vendor_gstin or "-", small_style),
                    Paragraph(result.gstr2b_invoice_number or result.gstr2a_vch_no or "-", small_style),
                    Paragraph(_fmt_inr(result.gstr2a_invoice_amount), right_style),
                    Paragraph(_fmt_inr(result.gstr2b_invoice_value), right_style),
                    Paragraph(reason, small_style),
                ]
            )

        results_table = Table(
            result_rows,
            repeatRows=1,
            colWidths=[22 * mm, 30 * mm, 28 * mm, 24 * mm, 24 * mm, 52 * mm],
        )
        results_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#182844")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5d5d5")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
                    ("PADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(results_table)
        story.append(Spacer(1, 10))

        def _result_tax_total(result) -> float:
            if result.gstr2b_igst is not None or result.gstr2b_cgst is not None or result.gstr2b_sgst is not None:
                return round((result.gstr2b_igst or 0.0) + (result.gstr2b_cgst or 0.0) + (result.gstr2b_sgst or 0.0), 2)
            return round((result.gstr2a_igst or 0.0) + (result.gstr2a_cgst or 0.0) + (result.gstr2a_sgst or 0.0), 2)

        table_4a = round(sum(_result_tax_total(r) for r in reconciliation.results if r.match_status in {"EXACT_MATCH", "FUZZY_MATCH"}), 2)
        table_4b = round(sum(_result_tax_total(r) for r in reconciliation.results if r.match_status in {"MISSING_IN_2B", "MISSING_IN_BOOKS"}), 2)
        table_4c = round(table_4a - table_4b, 2)

        story.append(Paragraph("Report 2: GST-Ready Summary (Portal View)", heading_style))
        portal_rows = [
            ["GSTR-3B Table", "Description", "Amount"],
            ["4(A)", "ITC Available", _fmt_inr(table_4a)],
            ["4(B)", "ITC Reversed", _fmt_inr(table_4b)],
            ["4(C)", "Net ITC Available", _fmt_inr(table_4c)],
        ]
        portal_table = Table(portal_rows, colWidths=[28 * mm, 70 * mm, 30 * mm])
        portal_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#182844")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5d5d5")),
                    ("ALIGN", (2, 1), (2, -1), "RIGHT"),
                    ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(portal_table)

        def _draw_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#666666"))
            canvas.drawRightString(doc.pagesize[0] - 16 * mm, 10 * mm, f"Page {canvas.getPageNumber()}")
            canvas.restoreState()

        doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
        return buffer.getvalue()