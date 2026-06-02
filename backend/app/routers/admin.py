"""Admin routes — Manager-only dashboard + reports (TDD §4.6).

Every route is guarded by require_roles("Manager").

Notes on fidelity: online-presence and last_login are not tracked yet (would
need session/login auditing), so those fields are returned as null. Ticket
difficulty / quality_score are likewise not modeled, so the performance report
exposes the metrics we can actually compute from the data we store.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import TicketWork, User

router = APIRouter(prefix="/api/admin", tags=["admin"])

# TIMESTAMPDIFF(MINUTE, started_at, completed_at) — handling time in minutes.
_minutes = func.timestampdiff(text("MINUTE"), TicketWork.started_at, TicketWork.completed_at)


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


@router.get("/employees")
def employees(db: Session = Depends(get_db), _: dict = Depends(require_roles("Manager"))):
    """Team monitoring: open + completed-today ticket counts per employee."""
    today = _utc_today()

    open_counts = dict(
        db.execute(
            select(TicketWork.assigned_mechanic_id, func.count())
            .where(TicketWork.status.in_(["Pending", "In Progress"]))
            .group_by(TicketWork.assigned_mechanic_id)
        ).all()
    )
    completed_today = dict(
        db.execute(
            select(TicketWork.assigned_mechanic_id, func.count())
            .where(TicketWork.status == "Completed", func.date(TicketWork.completed_at) == today)
            .group_by(TicketWork.assigned_mechanic_id)
        ).all()
    )

    rows = db.scalars(select(User).order_by(User.full_name)).all()
    return [
        {
            "id": u.id,
            "name": u.full_name,
            "role": u.role,
            "online": None,        # presence not tracked yet
            "last_login": None,    # login auditing not implemented yet
            "tickets_open": int(open_counts.get(u.id, 0)),
            "tickets_completed_today": int(completed_today.get(u.id, 0)),
        }
        for u in rows
    ]


@router.get("/tickets/summary")
def tickets_summary(db: Session = Depends(get_db), _: dict = Depends(require_roles("Manager"))):
    """Counts per status + average completion time across completed tickets."""
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


@router.get("/tickets/by-day")
def tickets_by_day(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("Manager")),
):
    """Per-day created/completed counts and average handling time over a range."""
    end = end_date or _utc_today()
    start = start_date or (end - timedelta(days=30))
    if start > end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_date must be <= end_date.")

    upper = datetime.combine(end, datetime.max.time())  # include all of end day
    lower = datetime.combine(start, datetime.min.time())

    created = dict(
        db.execute(
            select(func.date(TicketWork.created_at), func.count())
            .where(TicketWork.created_at.between(lower, upper))
            .group_by(func.date(TicketWork.created_at))
        ).all()
    )
    completed = dict(
        db.execute(
            select(func.date(TicketWork.completed_at), func.count())
            .where(
                TicketWork.status == "Completed",
                TicketWork.completed_at.between(lower, upper),
            )
            .group_by(func.date(TicketWork.completed_at))
        ).all()
    )
    avg_time = dict(
        db.execute(
            select(func.date(TicketWork.completed_at), func.avg(_minutes))
            .where(
                TicketWork.status == "Completed",
                TicketWork.completed_at.between(lower, upper),
                TicketWork.started_at.is_not(None),
            )
            .group_by(func.date(TicketWork.completed_at))
        ).all()
    )

    all_days = sorted(set(created) | set(completed))
    return [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "tickets_created": int(created.get(d, 0)),
            "tickets_completed": int(completed.get(d, 0)),
            "avg_completion_minutes": (
                round(float(avg_time[d]), 2) if avg_time.get(d) is not None else None
            ),
        }
        for d in all_days
    ]


@router.get("/reports/performance")
def performance(
    mechanic_id: int = Query(...),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("Manager")),
):
    """Quality-oriented performance metrics for a single mechanic."""
    user = db.get(User, mechanic_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mechanic not found.")

    completed_count = db.scalar(
        select(func.count())
        .select_from(TicketWork)
        .where(TicketWork.assigned_mechanic_id == mechanic_id, TicketWork.status == "Completed")
    )
    total_minutes = db.scalar(
        select(func.sum(_minutes)).where(
            TicketWork.assigned_mechanic_id == mechanic_id,
            TicketWork.status == "Completed",
            TicketWork.started_at.is_not(None),
            TicketWork.completed_at.is_not(None),
        )
    )
    avg_minutes = db.scalar(
        select(func.avg(_minutes)).where(
            TicketWork.assigned_mechanic_id == mechanic_id,
            TicketWork.status == "Completed",
            TicketWork.started_at.is_not(None),
            TicketWork.completed_at.is_not(None),
        )
    )

    total_minutes = float(total_minutes) if total_minutes is not None else 0.0
    return {
        "mechanic_id": mechanic_id,
        "mechanic_name": user.full_name,
        "tickets_completed": int(completed_count or 0),
        "total_work_hours": round(total_minutes / 60, 2),
        "avg_time_per_ticket_minutes": round(float(avg_minutes), 2) if avg_minutes is not None else None,
    }
