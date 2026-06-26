"""Create the database and all tables from the ORM models.

Usage:  python -m app.init_db
"""
from sqlalchemy import select, text

from .catalog_data import VEHICLE_CATALOG
from .config import settings
from .database import Base, SessionLocal, engine, ensure_database
from . import models  # noqa: F401  (import registers the models on Base.metadata)
from .models import VehicleModel

# Lightweight, idempotent column additions for existing tables. create_all()
# only creates MISSING tables, never alters existing ones, so new columns added
# to a table that already exists must be applied here. Each is a best-effort
# ALTER that ignores the "duplicate column" error (MySQL 1060).
_COLUMN_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN last_login DATETIME NULL",
    "ALTER TABLE parts_inventory ADD CONSTRAINT uq_parts_part_code UNIQUE (part_code)",
    "ALTER TABLE tickets_work ADD COLUMN archived_at DATETIME NULL",
    "ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email)",
]

# Errors that mean "already applied" and can be safely ignored.
_ALREADY_APPLIED = ("1060", "Duplicate column", "1061", "Duplicate key name")


def _apply_column_migrations() -> None:
    with engine.connect() as conn:
        for sql in _COLUMN_MIGRATIONS:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as exc:
                conn.rollback()
                msg = str(exc)
                if any(token in msg for token in _ALREADY_APPLIED):
                    continue  # already applied
                if "1062" in msg or "Duplicate entry" in msg:
                    # Existing duplicate data blocks a UNIQUE constraint — warn,
                    # don't crash the whole init.
                    print(f"  WARNING: skipped migration (duplicate data): {sql}")
                    continue
                raise


def seed_catalog(db=None) -> int:
    """Populate the vehicle make/model catalog. Idempotent — inserts only the
    (manufacturer, model) pairs that are missing. Returns rows added."""
    own = db is None
    db = db or SessionLocal()
    try:
        existing = {(m, mo) for m, mo in db.execute(
            select(VehicleModel.manufacturer, VehicleModel.model)
        ).all()}
        added = 0
        for manufacturer, models_ in VEHICLE_CATALOG.items():
            for model in models_:
                if (manufacturer, model) not in existing:
                    db.add(VehicleModel(manufacturer=manufacturer, model=model))
                    added += 1
        db.commit()
        return added
    finally:
        if own:
            db.close()


def main() -> None:
    print(f'Ensuring database "{settings.DB_NAME}" ...')
    ensure_database(settings.DB_NAME)
    print("Creating tables ...")
    Base.metadata.create_all(bind=engine)
    _apply_column_migrations()
    added = seed_catalog()
    print(f"Schema applied successfully. Catalog: {added} new make/model rows.")


if __name__ == "__main__":
    main()
