"""Vehicle routes — CRUD + plate search (FR-2)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ALL_ROLES, STAFF, require_roles
from ..models import Customer, Vehicle
from ..schemas import VehicleCreate, VehicleUpdate

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


@router.get("/search")
def search_vehicle(
    license_plate: str = Query(...),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    """Plate lookup -> vehicle + owner (auto-fill payload), or {found: false}."""
    row = db.execute(
        select(Vehicle, Customer)
        .join(Customer, Customer.id == Vehicle.customer_id)
        .where(Vehicle.license_plate == license_plate)
    ).first()

    if row is None:
        return {"found": False}

    vehicle, customer = row
    return {
        "vehicle_id": vehicle.id,
        "license_plate": vehicle.license_plate,
        "manufacturer": vehicle.manufacturer,
        "model": vehicle.model,
        "year": vehicle.year,
        "customer_id": customer.id,
        "customer_name": customer.full_name,
        "customer_phone": customer.phone_number,
    }


@router.get("")
def list_vehicles(
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    rows = db.execute(
        select(Vehicle, Customer.full_name)
        .join(Customer, Customer.id == Vehicle.customer_id)
        .order_by(Vehicle.created_at.desc())
    ).all()
    return [
        {
            "id": v.id,
            "license_plate": v.license_plate,
            "manufacturer": v.manufacturer,
            "model": v.model,
            "year": v.year,
            "customer_id": v.customer_id,
            "customer_name": name,
        }
        for v, name in rows
    ]


@router.get("/{vehicle_id}")
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    row = db.execute(
        select(Vehicle, Customer)
        .join(Customer, Customer.id == Vehicle.customer_id)
        .where(Vehicle.id == vehicle_id)
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found.")
    vehicle, customer = row
    return {
        "id": vehicle.id,
        "license_plate": vehicle.license_plate,
        "manufacturer": vehicle.manufacturer,
        "model": vehicle.model,
        "year": vehicle.year,
        "customer_id": customer.id,
        "customer_name": customer.full_name,
        "customer_phone": customer.phone_number,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_vehicle(
    body: VehicleCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    if db.get(Customer, body.customer_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "customer_id does not exist.")

    vehicle = Vehicle(
        customer_id=body.customer_id,
        license_plate=body.license_plate,
        manufacturer=body.manufacturer,
        model=body.model,
        year=body.year,
    )
    db.add(vehicle)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A vehicle with this license_plate already exists.",
        )
    db.refresh(vehicle)
    return {
        "id": vehicle.id,
        "customer_id": vehicle.customer_id,
        "license_plate": vehicle.license_plate,
        "manufacturer": vehicle.manufacturer,
        "model": vehicle.model,
        "year": vehicle.year,
        "created_at": vehicle.created_at,
    }


@router.put("/{vehicle_id}")
def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found.")

    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide at least one field to update.")
    for key, value in data.items():
        setattr(vehicle, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A vehicle with this license_plate already exists.",
        )
    db.refresh(vehicle)
    return {
        "id": vehicle.id,
        "customer_id": vehicle.customer_id,
        "license_plate": vehicle.license_plate,
        "manufacturer": vehicle.manufacturer,
        "model": vehicle.model,
        "year": vehicle.year,
        "created_at": vehicle.created_at,
    }
