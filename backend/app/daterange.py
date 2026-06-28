"""Shared date-range helpers for dashboard/list filtering.

A range filters by a ticket's open date (created_at) and is INCLUSIVE on both
ends. Either bound may be omitted for an open-ended range.
"""
from datetime import date, datetime

from fastapi import HTTPException, status


def date_bounds(start_date: date | None, end_date: date | None):
    """Convert (start_date, end_date) to inclusive datetime bounds.

    Returns (lower, upper) where either may be None. Raises 400 if start > end.
    """
    lower = datetime.combine(start_date, datetime.min.time()) if start_date else None
    upper = datetime.combine(end_date, datetime.max.time()) if end_date else None
    if lower is not None and upper is not None and lower > upper:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_date must be <= end_date.")
    return lower, upper


def range_conditions(column, lower, upper) -> list:
    """Build SQLAlchemy conditions restricting `column` to [lower, upper]."""
    conds = []
    if lower is not None:
        conds.append(column >= lower)
    if upper is not None:
        conds.append(column <= upper)
    return conds
