"""Create the database and all tables from the ORM models.

Usage:  python -m app.init_db
"""
from sqlalchemy import text

from .config import settings
from .database import Base, engine, ensure_database
from . import models  # noqa: F401  (import registers the models on Base.metadata)

# Lightweight, idempotent column additions for existing tables. create_all()
# only creates MISSING tables, never alters existing ones, so new columns added
# to a table that already exists must be applied here. Each is a best-effort
# ALTER that ignores the "duplicate column" error (MySQL 1060).
_COLUMN_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN last_login DATETIME NULL",
    "ALTER TABLE parts_inventory ADD CONSTRAINT uq_parts_part_code UNIQUE (part_code)",
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


def main() -> None:
    print(f'Ensuring database "{settings.DB_NAME}" ...')
    ensure_database(settings.DB_NAME)
    print("Creating tables ...")
    Base.metadata.create_all(bind=engine)
    _apply_column_migrations()
    print("Schema applied successfully.")


if __name__ == "__main__":
    main()
