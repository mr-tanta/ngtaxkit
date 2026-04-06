"""Utility functions for ngtaxkit — banker's rounding and date utilities."""

from __future__ import annotations

import datetime
from decimal import ROUND_HALF_EVEN, Decimal


def bankers_round(value: float) -> float:
    """Banker's rounding (round-half-even) to 2 decimal places.

    Uses Python's decimal module with ROUND_HALF_EVEN to avoid
    systematic rounding bias in monetary calculations.
    """
    d = Decimal(str(value))
    rounded = d.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
    return float(rounded)


# ─── Nigerian Public Holidays ────────────────────────────────────────────────

NIGERIAN_PUBLIC_HOLIDAYS_2026: frozenset[str] = frozenset([
    # Fixed public holidays
    "2026-01-01",  # New Year's Day
    "2026-05-01",  # Workers' Day
    "2026-06-12",  # Democracy Day
    "2026-10-01",  # Independence Day
    "2026-12-25",  # Christmas Day
    "2026-12-26",  # Boxing Day
    # Approximate Islamic holidays for 2026
    "2026-03-20",  # Eid al-Fitr
    "2026-03-21",  # Eid al-Fitr Day 2
    "2026-05-27",  # Eid al-Adha
    "2026-05-28",  # Eid al-Adha Day 2
    "2026-06-17",  # Eid al-Maulud
])


def is_public_holiday(date_str: str) -> bool:
    """Returns True if the given ISO date string falls on a Nigerian public holiday."""
    return date_str in NIGERIAN_PUBLIC_HOLIDAYS_2026


def is_weekend(date_str: str) -> bool:
    """Returns True if the given ISO date string falls on a weekend (Saturday or Sunday)."""
    dt = _parse_date(date_str)
    return dt.weekday() >= 5  # 5=Saturday, 6=Sunday


def is_non_working_day(date_str: str) -> bool:
    """Returns True if the given date is a non-working day (weekend or public holiday)."""
    return is_weekend(date_str) or is_public_holiday(date_str)


def next_working_day(date_str: str) -> str:
    """Advance a date to the next working day if it falls on a weekend or public holiday."""
    current = _parse_date(date_str)
    current_str = _format_date(current)
    while is_non_working_day(current_str):
        current += datetime.timedelta(days=1)
        current_str = _format_date(current)
    return current_str


def add_working_days(start_date: str, days: int) -> str:
    """Add N working days to a start date, skipping weekends and Nigerian public holidays.

    Day counting starts the day after start_date.
    """
    current = _parse_date(start_date)
    remaining = days
    while remaining > 0:
        current += datetime.timedelta(days=1)
        current_str = _format_date(current)
        if not is_non_working_day(current_str):
            remaining -= 1
    return _format_date(current)


def get_remittance_deadline(payment_date: str, day_of_month: int) -> str:
    """Calculate a remittance deadline: the Nth day of the month following the payment date.

    If that day falls on a weekend or public holiday, moves forward to the next working day.
    """
    dt = _parse_date(payment_date)
    year = dt.year
    month = dt.month + 1
    if month > 12:
        month = 1
        year += 1

    # Clamp day_of_month to the last day of the target month
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    clamped_day = min(day_of_month, last_day)

    deadline_str = f"{year}-{month:02d}-{clamped_day:02d}"
    return next_working_day(deadline_str)


# ─── Internal Helpers ─────────────────────────────────────────────────────────


def _parse_date(date_str: str) -> datetime.date:
    """Parse an ISO date string (YYYY-MM-DD) into a date object."""
    return datetime.date.fromisoformat(date_str)


def _format_date(dt: datetime.date) -> str:
    """Format a date object as an ISO date string (YYYY-MM-DD)."""
    return dt.isoformat()
