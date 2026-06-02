"""Workflow Service — the backend State Machine for work tickets (TDD §6.1).

Legal lifecycle:  Pending -> In Progress -> Completed  (no going back).
Enforced server-side so the frontend can never bypass it.
"""

VALID_TRANSITIONS: dict[str, list[str]] = {
    "Pending": ["In Progress"],
    "In Progress": ["Completed"],
    "Completed": [],  # terminal
}


def validate_transition(current_status: str, new_status: str) -> bool:
    """Is current_status -> new_status allowed by the state machine?"""
    return new_status in VALID_TRANSITIONS.get(current_status, [])


def authorize_status_change(user: dict, ticket) -> bool:
    """May this user change this ticket's status? (TDD §4.5)

    Manager/Secretary: any ticket. Mechanic: only their own.
    `ticket` may be an ORM object or a mapping exposing assigned_mechanic_id.
    """
    if not user or ticket is None:
        return False
    role = user.get("role")
    if role in ("Manager", "Secretary"):
        return True
    if role == "Mechanic":
        assigned = getattr(ticket, "assigned_mechanic_id", None)
        if assigned is None and isinstance(ticket, dict):
            assigned = ticket.get("assigned_mechanic_id")
        return assigned == user.get("user_id")
    return False
