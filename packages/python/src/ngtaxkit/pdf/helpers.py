"""Shared helpers for PDF generation -- formatting, constants."""

from __future__ import annotations


# --- Colors ----------------------------------------------------------------

COLOR_PRIMARY = (26, 26, 46)       # #1a1a2e
COLOR_SECONDARY = (85, 85, 85)     # #555555
COLOR_HEADER_BG = (240, 240, 240)  # #f0f0f0
COLOR_LINE = (204, 204, 204)       # #cccccc
COLOR_WHITE = (255, 255, 255)

# --- Layout ----------------------------------------------------------------

PAGE_MARGIN = 15  # mm (fpdf2 uses mm by default)
CONTENT_WIDTH = 180  # A4 width (210mm) minus 2 * 15mm margins


def format_currency(amount: float, *, pdf_safe: bool = False) -> str:
    """Format a number as Nigerian Naira: ₦X,XXX,XXX.XX

    When *pdf_safe* is True, uses "NGN " prefix instead of the ₦ symbol
    to stay within the latin-1 encoding range required by core PDF fonts.
    """
    sign = "-" if amount < 0 else ""
    abs_amount = abs(amount)
    whole = int(abs_amount)
    decimal = round((abs_amount - whole) * 100)
    whole_str = f"{whole:,}"
    prefix = "NGN " if pdf_safe else "\u20a6"
    return f"{sign}{prefix}{whole_str}.{decimal:02d}"


def format_date(iso: str) -> str:
    """Convert YYYY-MM-DD to DD/MM/YYYY."""
    parts = iso.split("-")
    if len(parts) != 3:
        return iso
    return f"{parts[2]}/{parts[1]}/{parts[0]}"
