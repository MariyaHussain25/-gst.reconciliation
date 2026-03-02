"""Date utility functions - rewrite of date-helpers.ts"""

from datetime import datetime


def parse_gstr2a_date(date_str: str) -> datetime:
    """Parse GSTR-2A date format: '15-Mar-23'"""
    return datetime.strptime(date_str.strip(), "%d-%b-%y")


def parse_gstr2b_date(date_str: str) -> datetime:
    """Parse GSTR-2B date format: '25/03/2023'"""
    return datetime.strptime(date_str.strip(), "%d/%m/%Y")


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
