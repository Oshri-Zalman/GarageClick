"""Parts routes — compatibility lookup + inventory management (TDD §4.4)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ALL_ROLES, STAFF, require_roles
from ..models import PartInventory
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
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*STAFF)),
):
    rows = db.scalars(select(PartInventory).order_by(PartInventory.part_name)).all()
    return [_serialize(p) for p in rows]


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
