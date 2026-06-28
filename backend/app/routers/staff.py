"""Staff (Manager + Secretary) operational endpoints.

Distinct from /api/admin/* (Manager-only): these expose lightweight operational
data — ticket counts + average handling time — WITHOUT per-employee performance
or monitoring. Lets the Secretary dashboard show an accurate, efficient summary
instead of computing it from the paginated /api/tickets list.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..daterange import date_bounds, range_conditions
from ..deps import STAFF, require_roles
from ..models import TicketWork

router = APIRouter(prefix="/api/staff", tags=["staff"])

_minutes = func.timestampdiff(text("MINUTE"), TicketWork.started_at, TicketWork.completed_at)


@router.get("/tickets/summary")
def staff_tickets_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    """Operational ticket summary (counts per status + avg completion minutes).
    Optional date range filters by ticket open date (created_at)."""
    lower, upper = date_bounds(start_date, end_date)
    rng = range_conditions(TicketWork.created_at, lower, upper)

    counts = dict(
        db.execute(
            select(TicketWork.status, func.count()).where(*rng).group_by(TicketWork.status)
        ).all()
    )
    avg_minutes = db.scalar(
        select(func.avg(_minutes)).where(
            TicketWork.status == "Completed",
            TicketWork.started_at.is_not(None),
            TicketWork.completed_at.is_not(None),
            *rng,
        )
    )
    return {
        "total_pending": int(counts.get("Pending", 0)),
        "total_in_progress": int(counts.get("In Progress", 0)),
        "total_completed": int(counts.get("Completed", 0)),
        "avg_completion_minutes": round(float(avg_minutes), 2) if avg_minutes is not None else None,
    }
