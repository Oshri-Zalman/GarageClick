"""Vehicle make/model catalog — source of truth for the frontend dropdowns.

Read-only, available to any authenticated user (the ticket-creation form is used
by Manager, Secretary, and Mechanic).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ALL_ROLES, require_roles
from ..models import VehicleModel

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/manufacturers")
def list_manufacturers(
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    """All known manufacturers, sorted."""
    return list(
        db.scalars(
            select(distinct(VehicleModel.manufacturer)).order_by(VehicleModel.manufacturer)
        ).all()
    )


@router.get("/models")
def list_models(
    manufacturer: str = Query(...),
    db: Session = Depends(get_db),
    _: dict = Depends(require_roles(*ALL_ROLES)),
):
    """Models for a given manufacturer (for the cascading dropdown)."""
    return list(
        db.scalars(
            select(VehicleModel.model)
            .where(VehicleModel.manufacturer == manufacturer)
            .order_by(VehicleModel.model)
        ).all()
    )
