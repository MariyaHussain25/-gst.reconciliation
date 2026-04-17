"""Date utility functions — Phase 4 Complete Implementation"""

from datetime import datetime


# All 7 GST date formats tried in order; flag indicates 2-digit year
_GST_DATE_FORMATS = [
    ("%d-%b-%y", True),          # 15-Mar-23           (GSTR-2A Tally)
    ("%d/%m/%Y", False),         # 25/03/2023          (GSTR-2B govt portal)
    ("%Y-%m-%d %H:%M:%S", False),# 2023-03-25 00:00:00 (openpyxl datetime str)
    ("%Y-%m-%d", False),         # 2023-03-25          (ISO)
    ("%d-%m-%Y", False),         # 25-03-2023          (GSTR-2B variants)
    ("%d-%m-%y", True),          # 15-03-23            (numeric short, dashes)
    ("%d.%m.%y", True),          # 15.03.23            (numeric short, dots)
]


def _fix_two_digit_year(dt: datetime) -> datetime:
    """Apply GST two-digit year convention: 00-49 → 2000-2049, 50-99 → 1950-1999.

    Python's %y maps 00-68 → 2000-2068 and 69-99 → 1969-1999, so we need to
    correct years in the range 2050-2068 by subtracting 100.
    """
    if 2050 <= dt.year <= 2068:
        return dt.replace(year=dt.year - 100)
    return dt


def parse_gst_date(date_str: str) -> datetime:
    """Parse any of the 6 GST date formats into a datetime object.

    Supports:
      15-Mar-23   (D-Mon-YY)
      25/03/2023  (DD/MM/YYYY)
      2023-03-25  (YYYY-MM-DD)
      25-03-2023  (DD-MM-YYYY)
      15-03-23    (DD-MM-YY)
      15.03.23    (DD.MM.YY)

    For 2-digit years: 00-49 → 2000-2049, 50-99 → 1950-1999

    Raises:
        ValueError: if the string does not match any supported format.
    """
    if not date_str:
        raise ValueError("Cannot parse empty date string")

    cleaned = str(date_str).strip()
    for fmt, has_two_digit_year in _GST_DATE_FORMATS:
        try:
            dt = datetime.strptime(cleaned, fmt)
            if has_two_digit_year:
                dt = _fix_two_digit_year(dt)
            return dt
        except ValueError:
            continue

    raise ValueError(
        f"Date '{cleaned}' does not match any supported GST format. "
        f"Supported formats: D-Mon-YY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD-MM-YY, DD.MM.YY"
    )


def format_date_to_iso(date_str: str) -> str:
    """Parse any GST date string and return it in YYYY-MM-DD format."""
    return parse_gst_date(date_str).strftime("%Y-%m-%d")


def derive_period_from_date(date_str: str) -> str:
    """Parse any GST date string and return YYYY-MM period string."""
    return to_period(parse_gst_date(date_str))


def to_period(dt: datetime) -> str:
    """Returns period string in YYYY-MM format."""
    return dt.strftime("%Y-%m")


def derive_financial_year(period: str) -> str:
    """Derive financial year from period. '2023-03' → '2022-23'"""
    try:
        year = int(period[:4])
        month = int(period[5:7])
        if month >= 4:
            return f"{year}-{str(year + 1)[2:]}"
        else:
            return f"{year - 1}-{str(year)[2:]}"
    except (ValueError, IndexError):
        return ""
