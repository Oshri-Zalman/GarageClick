"""Assignable-mechanics listing for the ticket "עובד מטפל" dropdown.

Separate from the Manager-only /api/admin/employees endpoint: this one is
available to Manager AND Secretary (both can assign tickets), but exposes only
the minimal, non-sensitive fields needed to populate the dropdown.

The roles returned mirror what ticket creation actually accepts as
assigned_mechanic_id (Mechanic or Manager), so the dropdown can never offer an
assignee the backend would reject.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import STAFF, require_roles
from ..models import User

router = APIRouter(prefix="/api/mechanics", tags=["mechanics"])

# Roles that may be assigned the work on a ticket (must match tickets.create).
ASSIGNABLE_ROLES = ("Mechanic", "Manager")


@router.get("")
def list_assignable_mechanics(
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    """Active users that can be assigned to a ticket (Manager + Secretary only)."""
    rows = db.scalars(
        select(User)
        .where(User.is_active.is_(True), User.role.in_(ASSIGNABLE_ROLES))
        .order_by(User.full_name)
    ).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
        }
        for u in rows
    ]
