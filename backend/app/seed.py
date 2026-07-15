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

# A diverse spare-parts catalog for the warehouse. 15 vehicle-specific parts +
# 5 GENERAL parts (manufacturer/model/year_start = None -> fit any vehicle).
DEMO_PARTS = [
    # --- vehicle-specific ---
    {"part_name": "רפידות בלמים קדמיות", "part_code": "TOY-COR-BRK", "manufacturer": "Toyota", "model": "Corolla", "year_start": 2015, "quantity_current": 15},
    {"part_name": "פילטר אוויר", "part_code": "TOY-COR-AIR", "manufacturer": "Toyota", "model": "Corolla", "year_start": 2014, "quantity_current": 22},
    {"part_name": "דיסקיות בלם קדמיות", "part_code": "HYU-I30-DISC", "manufacturer": "Hyundai", "model": "i30", "year_start": 2016, "quantity_current": 8},
    {"part_name": "משאבת מים", "part_code": "HYU-TUC-WPUMP", "manufacturer": "Hyundai", "model": "Tucson", "year_start": 2017, "quantity_current": 4},
    {"part_name": "פילטר שמן", "part_code": "KIA-SPO-OIL", "manufacturer": "Kia", "model": "Sportage", "year_start": 2018, "quantity_current": 25},
    {"part_name": "נר הצתה", "part_code": "KIA-PIC-SPARK", "manufacturer": "Kia", "model": "Picanto", "year_start": 2016, "quantity_current": 40},
    {"part_name": "בולם זעזועים קדמי", "part_code": "MAZ-3-SHOCK", "manufacturer": "Mazda", "model": "3", "year_start": 2017, "quantity_current": 10},
    {"part_name": "מצבר 60Ah", "part_code": "SKO-OCT-BAT", "manufacturer": "Skoda", "model": "Octavia", "year_start": 2015, "quantity_current": 6},
    {"part_name": "רצועת טיימינג", "part_code": "VW-GOLF-TIMING", "manufacturer": "Volkswagen", "model": "Golf", "year_start": 2016, "quantity_current": 5},
    {"part_name": "חיישן חמצן", "part_code": "NIS-QAS-O2", "manufacturer": "Nissan", "model": "Qashqai", "year_start": 2017, "quantity_current": 9},
    {"part_name": "פילטר דלק", "part_code": "SUZ-SWI-FUEL", "manufacturer": "Suzuki", "model": "Swift", "year_start": 2018, "quantity_current": 12},
    {"part_name": "תרמוסטט", "part_code": "HON-CIV-THERMO", "manufacturer": "Honda", "model": "Civic", "year_start": 2016, "quantity_current": 11},
    {"part_name": "רפידות בלם אחוריות", "part_code": "BMW-320-BRKR", "manufacturer": "BMW", "model": "3 Series", "year_start": 2015, "quantity_current": 7},
    {"part_name": "גלגלת מתח", "part_code": "MER-C-TENS", "manufacturer": "Mercedes-Benz", "model": "C-Class", "year_start": 2017, "quantity_current": 6},
    {"part_name": "משאבת דלק", "part_code": "FOR-FOC-FPUMP", "manufacturer": "Ford", "model": "Focus", "year_start": 2016, "quantity_current": 5},
    # --- general (fit any vehicle) ---
    {"part_name": "שמן מנוע 5W-30 (ליטר)", "part_code": "GEN-OIL-5W30", "manufacturer": None, "model": None, "year_start": None, "quantity_current": 100},
    {"part_name": "נוזל בלמים DOT4", "part_code": "GEN-BRAKE-DOT4", "manufacturer": None, "model": None, "year_start": None, "quantity_current": 50},
    {"part_name": "נוזל קירור אדום", "part_code": "GEN-COOLANT", "manufacturer": None, "model": None, "year_start": None, "quantity_current": 60},
    {"part_name": 'מגבים אוניברסליים 24"', "part_code": "GEN-WIPER-24", "manufacturer": None, "model": None, "year_start": None, "quantity_current": 35},
    {"part_name": "נורת הלוגן H7", "part_code": "GEN-BULB-H7", "manufacturer": None, "model": None, "year_start": None, "quantity_current": 45},
]


def seed_parts(db: Session | None = None) -> int:
    """Insert the diverse parts catalog. Idempotent (skips by part_code)."""
    own = db is None
    db = db or SessionLocal()
    try:
        existing = set(db.scalars(select(PartInventory.part_code)).all())
        added = 0
        for p in DEMO_PARTS:
            if p["part_code"] not in existing:
                db.add(PartInventory(**p))
                added += 1
        db.commit()
        return added
    finally:
        if own:
            db.close()


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
    parts_added = seed_parts()
    print("Done. Demo users (password '{}'): {}".format(result["password"], ", ".join(result["users"])))
    print(f"Parts catalog: {parts_added} new parts added.")


if __name__ == "__main__":
    main()
