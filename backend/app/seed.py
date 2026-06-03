"""Seed the database with demo data for manual testing / demos.

Usage:  python -m app.seed

Idempotent: skips records that already exist (by natural key), so it is safe to
re-run. Prints the demo login credentials at the end.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, ensure_database
from .config import settings
from .init_db import _apply_column_migrations
from . import models  # noqa: F401  (register models)
from .models import Customer, PartInventory, TicketWork, User, Vehicle
from .security import hash_password

DEMO_PASSWORD = "demo1234"

DEMO_USERS = [
    {"username": "manager", "role": "Manager", "full_name": "מנהל המוסך"},
    {"username": "secretary", "role": "Secretary", "full_name": "מזכירה"},
    {"username": "mechanic", "role": "Mechanic", "full_name": "מכונאי ראשי"},
]


def _get_or_create_user(db: Session, username: str, role: str, full_name: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(
            username=username,
            password_hash=hash_password(DEMO_PASSWORD),
            role=role,
            full_name=full_name,
            is_active=True,
        )
        db.add(user)
        db.flush()
    return user


def seed_demo_data(db: Session | None = None) -> dict:
    own_session = db is None
    db = db or SessionLocal()
    try:
        users = {
            u["username"]: _get_or_create_user(db, u["username"], u["role"], u["full_name"])
            for u in DEMO_USERS
        }

        # Customer + vehicle
        customer = db.scalar(select(Customer).where(Customer.phone_number == "0521111111"))
        if customer is None:
            customer = Customer(full_name="דן ישראלי", phone_number="0521111111")
            db.add(customer)
            db.flush()
        vehicle = db.scalar(select(Vehicle).where(Vehicle.license_plate == "12-345-67"))
        if vehicle is None:
            vehicle = Vehicle(
                customer_id=customer.id, license_plate="12-345-67",
                manufacturer="Volkswagen", model="Golf", year=2019,
            )
            db.add(vehicle)
            db.flush()

        # Parts
        if db.scalar(select(PartInventory).where(PartInventory.part_code == "VW-BRK-1")) is None:
            db.add(PartInventory(part_name="רפידות בלמים", part_code="VW-BRK-1",
                                 manufacturer="Volkswagen", model="Golf",
                                 year_start=2015, quantity_current=12))
        if db.scalar(select(PartInventory).where(PartInventory.part_code == "VW-OIL-1")) is None:
            db.add(PartInventory(part_name="פילטר שמן", part_code="VW-OIL-1",
                                 manufacturer="Volkswagen", model="Golf",
                                 year_start=2010, quantity_current=20))

        # A sample pending ticket
        if db.scalar(select(TicketWork)) is None:
            t = TicketWork(
                ticket_number="TKT-00001", vehicle_id=vehicle.id,
                created_by_id=users["secretary"].id,
                assigned_mechanic_id=users["mechanic"].id,
                description="טיפול תקופתי", status="Pending",
            )
            db.add(t)

        db.commit()
        return {
            "users": list(users.keys()),
            "password": DEMO_PASSWORD,
            "customer_id": customer.id,
            "vehicle_id": vehicle.id,
        }
    finally:
        if own_session:
            db.close()


def main() -> None:
    print(f'Seeding demo data into "{settings.DB_NAME}" ...')
    ensure_database(settings.DB_NAME)
    Base.metadata.create_all(bind=engine)
    _apply_column_migrations()
    result = seed_demo_data()
    print("Done. Demo users (password '{}'): {}".format(result["password"], ", ".join(result["users"])))


if __name__ == "__main__":
    main()
