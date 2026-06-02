"""Create the database and all tables from the ORM models.

Usage:  python -m app.init_db
"""
from .config import settings
from .database import Base, engine, ensure_database
from . import models  # noqa: F401  (import registers the models on Base.metadata)


def main() -> None:
    print(f'Ensuring database "{settings.DB_NAME}" ...')
    ensure_database(settings.DB_NAME)
    print("Creating tables ...")
    Base.metadata.create_all(bind=engine)
    print("✓ Schema applied successfully.")


if __name__ == "__main__":
    main()
