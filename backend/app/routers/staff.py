"""Staff (Manager + Secretary) operational endpoints.

Distinct from /api/admin/* (Manager-only): these expose lightweight operational
data — ticket counts + average handling time — WITHOUT per-employee performance
or monitoring. Lets the Secretary dashboard show an accurate, efficient summary
instead of computing it from the paginated /api/tickets list.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import STAFF, require_roles
from ..models import TicketWork

router = APIRouter(prefix="/api/staff", tags=["staff"])

_minutes = func.timestampdiff(text("MINUTE"), TicketWork.started_at, TicketWork.completed_at)


@router.get("/tickets/summary")
def staff_tickets_summary(
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    """Operational ticket summary (counts per status + avg completion minutes)."""
    counts = dict(
        db.execute(select(TicketWork.status, func.count()).group_by(TicketWork.status)).all()
    )
    avg_minutes = db.scalar(
        select(func.avg(_minutes)).where(
            TicketWork.status == "Completed",
            TicketWork.started_at.is_not(None),
            TicketWork.completed_at.is_not(None),
        )
    )
    return {
        "total_pending": int(counts.get("Pending", 0)),
        "total_in_progress": int(counts.get("In Progress", 0)),
        "total_completed": int(counts.get("Completed", 0)),
        "avg_completion_minutes": round(float(avg_minutes), 2) if avg_minutes is not None else None,
    }
