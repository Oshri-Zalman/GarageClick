"""Customer routes — CRUD + search by license_plate (FR-1)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ALL_ROLES, STAFF, require_roles
from ..models import Customer, TicketWork, Vehicle
from ..pagination import envelope, pagination
from ..schemas import CustomerCreate, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _ticket_history(db: Session, *conditions) -> list[dict]:
    """Ticket history rows joined with the vehicle plate, newest first."""
    rows = db.execute(
        select(TicketWork, Vehicle.license_plate)
        .join(Vehicle, Vehicle.id == TicketWork.vehicle_id)
        .where(*conditions)
        .order_by(TicketWork.created_at.desc())
    ).all()
    return [
        {
            "id": t.id,
            "ticket_number": t.ticket_number,
            "status": t.status,
            "description": t.description,
            "license_plate": plate,
            "assigned_mechanic_id": t.assigned_mechanic_id,
            "created_at": t.created_at,
            "started_at": t.started_at,
            "completed_at": t.completed_at,
        }
        for t, plate in rows
    ]


def _serialize(customer: Customer) -> dict:
    return {
        "id": customer.id,
        "full_name": customer.full_name,
        "phone_number": customer.phone_number,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
    }


def _vehicles_of(db: Session, customer_id: int) -> list[dict]:
    rows = db.scalars(select(Vehicle).where(Vehicle.customer_id == customer_id)).all()
    return [
        {
            "id": v.id,
            "license_plate": v.license_plate,
            "manufacturer": v.manufacturer,
            "model": v.model,
            "year": v.year,
        }
        for v in rows
    ]


@router.get("/search")
def search_customers(
    license_plate: str = Query(...),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    """Find the customer that owns the given plate (with their vehicles)."""
    stmt = (
        select(Customer)
        .join(Vehicle, Vehicle.customer_id == Customer.id)
        .where(Vehicle.license_plate == license_plate)
    )
    results = []
    for customer in db.scalars(stmt).all():
        results.append({**_serialize(customer), "vehicles": _vehicles_of(db, customer.id)})
    return results


@router.get("")
def list_customers(
    page: dict = Depends(pagination),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    total = db.scalar(select(func.count()).select_from(Customer))
    rows = db.scalars(
        select(Customer)
        .order_by(Customer.created_at.desc())
        .limit(page["limit"])
        .offset(page["offset"])
    ).all()
    return envelope([_serialize(c) for c in rows], total, page)


@router.get("/{customer_id}/tickets")
def customer_tickets(
    customer_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    """Full ticket history for a customer (across all their vehicles)."""
    if db.get(Customer, customer_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found.")
    return _ticket_history(db, Vehicle.customer_id == customer_id)


@router.get("/{customer_id}")
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found.")
    return {**_serialize(customer), "vehicles": _vehicles_of(db, customer_id)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    customer = Customer(full_name=body.full_name, phone_number=body.phone_number)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _serialize(customer)


@router.put("/{customer_id}")
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found.")

    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide at least one field to update.")
    for key, value in data.items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return _serialize(customer)
