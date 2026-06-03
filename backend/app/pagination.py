"""Shared pagination helpers for list endpoints (TDD §7)."""
from fastapi import Query


def pagination(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict:
    """FastAPI dependency yielding page/limit/offset."""
    return {"page": page, "limit": limit, "offset": (page - 1) * limit}


def envelope(items: list, total, p: dict) -> dict:
    """Standard paginated response shape."""
    return {"items": items, "page": p["page"], "limit": p["limit"], "total": int(total)}
