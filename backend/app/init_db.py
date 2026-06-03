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
]


def _apply_column_migrations() -> None:
    with engine.connect() as conn:
        for sql in _COLUMN_MIGRATIONS:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as exc:  # duplicate column -> already applied
                conn.rollback()
                if "1060" not in str(exc) and "Duplicate column" not in str(exc):
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
