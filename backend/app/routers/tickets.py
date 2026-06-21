"""Ticket routes — transactional creation + state-machine status changes."""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ALL_ROLES, get_current_user, require_roles
from ..pagination import envelope, pagination
from ..models import (
    AuditLog,
    Customer,
    PartInventory,
    TicketPartUsed,
    TicketWork,
    User,
    Vehicle,
)
from ..schemas import StatusUpdate, TicketCreate
from ..services import notifications
from ..services.workflow import authorize_status_change, validate_transition

logger = logging.getLogger("garageclick.tickets")
router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _fetch_ticket(db: Session, ticket_id: int) -> dict | None:
    """Return a ticket joined with vehicle, customer, and mechanic (or None)."""
    row = db.execute(
        select(TicketWork, Vehicle, Customer, User.full_name)
        .join(Vehicle, Vehicle.id == TicketWork.vehicle_id)
        .join(Customer, Customer.id == Vehicle.customer_id)
        .join(User, User.id == TicketWork.assigned_mechanic_id)
        .where(TicketWork.id == ticket_id)
    ).first()
    if row is None:
        return None
    t, v, c, mechanic_name = row
    return {
        "id": t.id,
        "ticket_number": t.ticket_number,
        "vehicle_id": t.vehicle_id,
        "created_by_id": t.created_by_id,
        "assigned_mechanic_id": t.assigned_mechanic_id,
        "description": t.description,
        "status": t.status,
        "estimated_completion_time": t.estimated_completion_time,
        "created_at": t.created_at,
        "started_at": t.started_at,
        "completed_at": t.completed_at,
        "archived_at": t.archived_at,
        "license_plate": v.license_plate,
        "manufacturer": v.manufacturer,
        "model": v.model,
        "year": v.year,
        "customer_id": c.id,
        "customer_name": c.full_name,
        "customer_phone": c.phone_number,
        "mechanic_name": mechanic_name,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ticket(
    body: TicketCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles(*ALL_ROLES)),
):
    scenario_a = body.vehicle_id is not None
    scenario_b = bool(body.license_plate and body.new_customer and body.new_vehicle)
    if not scenario_a and not scenario_b:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'Provide either "vehicle_id" OR '
            '"license_plate" + "new_customer" + "new_vehicle".',
        )

    # A Mechanic may only open tickets assigned to themselves.
    if user["role"] == "Mechanic" and int(body.assigned_mechanic_id) != int(user["user_id"]):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "A Mechanic can only open tickets assigned to themselves.",
        )

    try:
        # The assigned user must exist and be active.
        mechanic = db.get(User, body.assigned_mechanic_id)
        if mechanic is None or not mechanic.is_active:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "assigned_mechanic_id does not refer to an active user.",
            )
        # Only a Mechanic (or a Manager working hands-on) can be assigned the
        # work — never a Secretary.
        if mechanic.role not in ("Mechanic", "Manager"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "assigned_mechanic_id must be a Mechanic or Manager.",
            )

        # ---- Resolve the vehicle ----
        if scenario_b:
            customer = Customer(
                full_name=body.new_customer.full_name,
                phone_number=body.new_customer.phone_number,
            )
            db.add(customer)
            db.flush()
            vehicle = Vehicle(
                customer_id=customer.id,
                license_plate=body.license_plate,
                manufacturer=body.new_vehicle.manufacturer,
                model=body.new_vehicle.model,
                year=body.new_vehicle.year,
            )
            db.add(vehicle)
            db.flush()  # surfaces duplicate-plate IntegrityError here
            vehicle_id = vehicle.id
        else:
            vehicle = db.get(Vehicle, body.vehicle_id)
            if vehicle is None:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "vehicle_id does not exist.")
            vehicle_id = vehicle.id

        # ---- Validate parts availability (lock rows FOR UPDATE) ----
        plan = []  # (PartInventory, quantity)
        for line in body.parts:
            part = db.scalar(
                select(PartInventory).where(PartInventory.id == line.part_id).with_for_update()
            )
            if part is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, f"part_id {line.part_id} does not exist."
                )
            if part.quantity_current < line.quantity:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f'Part "{part.part_name}" is out of stock '
                    f"(requested {line.quantity}, available {part.quantity_current}).",
                )
            plan.append((part, line.quantity))

        # ---- Create the ticket (temp number, then TKT-NNNNN from id) ----
        temp_number = f"TMP-{secrets.token_hex(6)}"
        ticket = TicketWork(
            ticket_number=temp_number,
            vehicle_id=vehicle_id,
            created_by_id=user["user_id"],
            assigned_mechanic_id=body.assigned_mechanic_id,
            description=body.description,
            estimated_completion_time=body.estimated_completion_time,
            status="Pending",
        )
        db.add(ticket)
        db.flush()
        ticket.ticket_number = f"TKT-{ticket.id:05d}"

        # ---- Record parts usage + deduct inventory ----
        for part, qty in plan:
            db.add(TicketPartUsed(ticket_id=ticket.id, part_id=part.id, quantity_used=qty))
            part.quantity_current -= qty

        # ---- Audit trail ----
        db.add(
            AuditLog(
                user_id=user["user_id"],
                action="ticket_created",
                resource_type="ticket",
                resource_id=ticket.id,
                old_value=None,
                new_value=ticket.ticket_number,
            )
        )

        db.commit()
        ticket_id = ticket.id
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A vehicle with this license_plate already exists.",
        )
    except Exception:
        db.rollback()
        raise

    return _fetch_ticket(db, ticket_id)


@router.patch("/{ticket_id}/status")
def update_status(
    ticket_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles(*ALL_ROLES)),
):
    ticket = db.get(TicketWork, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found.")

    # Authorize first (don't leak transition info).
    if not authorize_status_change(user, ticket):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You are not allowed to update this ticket."
        )

    if not validate_transition(ticket.status, body.new_status):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Illegal transition: {ticket.status} -> {body.new_status}.",
        )

    # Completing requires explicit confirmation (FR-3 / NFR-3).
    if body.new_status == "Completed" and body.confirmation is not True:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'Completing a ticket requires "confirmation": true.',
        )

    # Use the DB clock (func.now()) so started_at/completed_at are consistent
    # with created_at (CURRENT_TIMESTAMP) — same timezone, same date boundaries.
    old_status = ticket.status
    ticket.status = body.new_status
    if body.new_status == "In Progress":
        ticket.started_at = func.now()
    elif body.new_status == "Completed":
        ticket.completed_at = func.now()

    # Audit the transition (TDD §3.1 / §6.1) — atomic with the status change.
    db.add(
        AuditLog(
            user_id=user["user_id"],
            action="status_changed",
            resource_type="ticket",
            resource_id=ticket_id,
            old_value=old_status,
            new_value=body.new_status,
        )
    )

    db.commit()
    result = _fetch_ticket(db, ticket_id)

    # Completion hook: notify the customer via (mock) WhatsApp. A notification
    # failure must never break the status update, so it is best-effort.
    if body.new_status == "Completed":
        try:
            notifications.notify_ticket_completed(result)
        except Exception:  # pragma: no cover
            logger.exception("WhatsApp notification failed for ticket %s", ticket_id)

    return result


@router.post("/{ticket_id}/archive")
def archive_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles(*ALL_ROLES)),
):
    """Close/archive a COMPLETED ticket: it stays in the DB and history but
    leaves the active board. Same authorization as a status change."""
    ticket = db.get(TicketWork, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found.")
    if not authorize_status_change(user, ticket):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You are not allowed to archive this ticket."
        )
    if ticket.status != "Completed":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a completed ticket can be archived."
        )
    if ticket.archived_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ticket is already archived.")

    ticket.archived_at = func.now()
    db.add(
        AuditLog(
            user_id=user["user_id"],
            action="ticket_archived",
            resource_type="ticket",
            resource_id=ticket_id,
            old_value=None,
            new_value="archived",
        )
    )
    db.commit()
    return _fetch_ticket(db, ticket_id)


@router.get("")
def list_tickets(
    status_filter: str | None = Query(default=None, alias="status"),
    mechanic_id: int | None = Query(default=None),
    include_archived: bool = Query(default=False),
    page: dict = Depends(pagination),
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles(*ALL_ROLES)),
):
    """Paginated ticket list (the Kanban board). Mechanic is forced to their own;
    Manager/Secretary see all. Archived (closed) tickets are excluded unless
    include_archived=true."""
    conditions = []
    if user["role"] == "Mechanic":
        conditions.append(TicketWork.assigned_mechanic_id == user["user_id"])
    elif mechanic_id is not None:
        conditions.append(TicketWork.assigned_mechanic_id == mechanic_id)
    if status_filter:
        conditions.append(TicketWork.status == status_filter)
    if not include_archived:
        conditions.append(TicketWork.archived_at.is_(None))

    total = db.scalar(
        select(func.count()).select_from(TicketWork).where(*conditions)
    )

    stmt = (
        select(TicketWork, Vehicle, Customer, User.full_name)
        .join(Vehicle, Vehicle.id == TicketWork.vehicle_id)
        .join(Customer, Customer.id == Vehicle.customer_id)
        .join(User, User.id == TicketWork.assigned_mechanic_id)
        .where(*conditions)
        .order_by(TicketWork.created_at.desc())
        .limit(page["limit"])
        .offset(page["offset"])
    )

    results = []
    for t, v, c, mechanic_name in db.execute(stmt).all():
        results.append(
            {
                "id": t.id,
                "ticket_number": t.ticket_number,
                "vehicle_id": t.vehicle_id,
                "created_by_id": t.created_by_id,
                "assigned_mechanic_id": t.assigned_mechanic_id,
                "description": t.description,
                "status": t.status,
                "created_at": t.created_at,
                "started_at": t.started_at,
                "completed_at": t.completed_at,
                "archived_at": t.archived_at,
                "license_plate": v.license_plate,
                "manufacturer": v.manufacturer,
                "model": v.model,
                "year": v.year,
                "customer_name": c.full_name,
                "customer_phone": c.phone_number,
                "mechanic_name": mechanic_name,
            }
        )
    return envelope(results, total, page)


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    ticket = _fetch_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found.")
    if user["role"] == "Mechanic" and ticket["assigned_mechanic_id"] != user["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")
    return ticket
