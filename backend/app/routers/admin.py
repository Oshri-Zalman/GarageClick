"""Admin routes — Manager-only dashboard + reports (TDD §4.6).

Every route is guarded by require_roles("Manager").

Notes on fidelity: online-presence and last_login are not tracked yet (would
need session/login auditing), so those fields are returned as null. Ticket
difficulty / quality_score are likewise not modeled, so the performance report
exposes the metrics we can actually compute from the data we store.
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import TicketWork, User
from ..schemas import UserCreate, UserUpdate
from ..security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "full_name": u.full_name,
        "email": u.email,
        "is_active": u.is_active,
        "created_at": u.created_at,
    }

# TIMESTAMPDIFF(MINUTE, started_at, completed_at) — handling time in minutes.
_minutes = func.timestampdiff(text("MINUTE"), TicketWork.started_at, TicketWork.completed_at)


def _today() -> date:
    # Server-local date, matching the DB's CURRENT_TIMESTAMP columns.
    return date.today()


@router.get("/employees")
def employees(db: Session = Depends(get_db), _: dict = Depends(require_roles("Manager"))):
    """Team monitoring: open + completed-today ticket counts per employee."""
    today = _today()

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
            "online": None,            # real-time presence not tracked yet
            "last_login": u.last_login,  # set on each successful login
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
    end = end_date or _today()
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


# ------------------------------------------------------------------
# User management (FR-6.4) — Manager only
# ------------------------------------------------------------------
@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("Manager")),
):
    """Full user list for the Manager's user-management screen (incl. username
    and is_active, which /api/admin/employees does not expose)."""
    rows = db.scalars(select(User).order_by(User.full_name)).all()
    return [_serialize_user(u) for u in rows]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles("Manager")),
):
    if db.scalar(select(User).where(User.username == body.username)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "username already exists.")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        full_name=body.full_name,
        email=body.email,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "email already exists.")
    db.refresh(user)
    return _serialize_user(user)


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("Manager")),
):
    """Update a user — change password, role, email, name, or activate/deactivate."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide at least one field to update.")

    # Prevent a manager from locking themselves out.
    if user_id == current["user_id"]:
        if data.get("is_active") is False:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "You cannot deactivate your own account."
            )
        if "role" in data and data["role"] != "Manager":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "You cannot remove your own Manager role."
            )

    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
    for key, value in data.items():
        setattr(user, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "email already exists.")
    db.refresh(user)
    return _serialize_user(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("Manager")),
):
    """Hard-delete a user. Blocked (409) if they are referenced by tickets or
    audit history — deactivate via PATCH is_active=false instead."""
    if user_id == current["user_id"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account.")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

    # Pre-check the obvious FK (tickets) for a clearer message.
    has_tickets = db.scalar(
        select(func.count())
        .select_from(TicketWork)
        .where(or_(TicketWork.created_by_id == user_id,
                   TicketWork.assigned_mechanic_id == user_id))
    )
    if has_tickets:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "User is referenced by tickets; deactivate (is_active=false) instead of deleting.",
        )

    try:
        db.delete(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "User is referenced by other records; deactivate instead of deleting.",
        )
    return {"deleted": True, "id": user_id}
