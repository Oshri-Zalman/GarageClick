"""Parts routes — compatibility lookup + inventory management (TDD §4.4)."""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ALL_ROLES, STAFF, require_roles
from ..models import PartInventory, TicketPartUsed, TicketWork, User, Vehicle
from ..pagination import envelope, pagination
from ..schemas import PartCreate, PartUpdate

router = APIRouter(prefix="/api/parts", tags=["parts"])


def _serialize(p: PartInventory) -> dict:
    return {
        "id": p.id,
        "part_name": p.part_name,
        "part_code": p.part_code,
        "manufacturer": p.manufacturer,
        "model": p.model,
        "year_start": p.year_start,
        "quantity_current": p.quantity_current,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("/compatible")
def get_compatible(
    manufacturer: str = Query(...),
    model: str = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    """Parts matching make/model with year_start <= year. Out-of-stock parts are
    returned too, flagged available=false (FR-7.2)."""
    rows = db.scalars(
        select(PartInventory)
        .where(
            PartInventory.manufacturer == manufacturer,
            PartInventory.model == model,
            PartInventory.year_start <= year,
        )
        .order_by(PartInventory.part_name)
    ).all()
    return [
        {
            "id": p.id,
            "part_name": p.part_name,
            "part_code": p.part_code,
            "manufacturer": p.manufacturer,
            "model": p.model,
            "year_start": p.year_start,
            "quantity_current": p.quantity_current,
            "available": p.quantity_current > 0,
        }
        for p in rows
    ]


@router.get("/inventory")
def list_inventory(
    page: dict = Depends(pagination),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    total = db.scalar(select(func.count()).select_from(PartInventory))
    rows = db.scalars(
        select(PartInventory)
        .order_by(PartInventory.part_name)
        .limit(page["limit"])
        .offset(page["offset"])
    ).all()
    return envelope([_serialize(p) for p in rows], total, page)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_part(
    body: PartCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    part = PartInventory(**body.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return _serialize(part)


@router.put("/{part_id}")
def update_part(
    part_id: int,
    body: PartUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    part = db.get(PartInventory, part_id)
    if part is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Part not found.")
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide at least one field to update.")
    for key, value in data.items():
        setattr(part, key, value)
    db.commit()
    db.refresh(part)
    return _serialize(part)


# ------------------------------------------------------------------
# Consumption report (FR-7.6) — Manager/Secretary
# ------------------------------------------------------------------
@router.get("/reports/consumption")
def consumption_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    """Parts consumption over a date range, broken down per FR-7.6:
    total, per-day, by vehicle manufacturer, and by employee (the assigned
    mechanic of the ticket the part was used on)."""
    end = end_date or date.today()
    start = start_date or (end - timedelta(days=30))
    if start > end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_date must be <= end_date.")

    lower = datetime.combine(start, datetime.min.time())
    upper = datetime.combine(end, datetime.max.time())
    qty = func.coalesce(func.sum(TicketPartUsed.quantity_used), 0)
    in_range = TicketPartUsed.created_at.between(lower, upper)

    total = db.scalar(select(qty).where(in_range)) or 0

    by_day = [
        {"date": d.isoformat() if hasattr(d, "isoformat") else str(d), "parts_used": int(n)}
        for d, n in db.execute(
            select(func.date(TicketPartUsed.created_at), qty)
            .where(in_range)
            .group_by(func.date(TicketPartUsed.created_at))
            .order_by(func.date(TicketPartUsed.created_at))
        ).all()
    ]

    by_vehicle = [
        {"manufacturer": manufacturer, "parts_used": int(n)}
        for manufacturer, n in db.execute(
            select(Vehicle.manufacturer, qty)
            .join(TicketWork, TicketWork.id == TicketPartUsed.ticket_id)
            .join(Vehicle, Vehicle.id == TicketWork.vehicle_id)
            .where(in_range)
            .group_by(Vehicle.manufacturer)
            .order_by(qty.desc())
        ).all()
    ]

    by_employee = [
        {"mechanic_id": mid, "mechanic_name": name, "parts_used": int(n)}
        for mid, name, n in db.execute(
            select(User.id, User.full_name, qty)
            .join(TicketWork, TicketWork.id == TicketPartUsed.ticket_id)
            .join(User, User.id == TicketWork.assigned_mechanic_id)
            .where(in_range)
            .group_by(User.id, User.full_name)
            .order_by(qty.desc())
        ).all()
    ]

    # Exactly which part was consumed and how many (the manager's "which part,
    # how many" question).
    by_part = [
        {"part_id": pid, "part_name": pname, "part_code": pcode, "parts_used": int(n)}
        for pid, pname, pcode, n in db.execute(
            select(PartInventory.id, PartInventory.part_name, PartInventory.part_code, qty)
            .join(PartInventory, PartInventory.id == TicketPartUsed.part_id)
            .where(in_range)
            .group_by(PartInventory.id, PartInventory.part_name, PartInventory.part_code)
            .order_by(qty.desc())
        ).all()
    ]

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "total_parts_used": int(total),
        "by_day": by_day,
        "by_part": by_part,
        "by_vehicle_manufacturer": by_vehicle,
        "by_employee": by_employee,
    }
