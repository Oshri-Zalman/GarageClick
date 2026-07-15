"""SQLAlchemy engine, session factory, and Base declarative class."""
from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# pool_pre_ping recycles dead connections (mirrors the Node pool's resilience).
engine = create_engine(
    settings.database_url(),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=5,
)


@event.listens_for(engine, "connect")
def _set_session_utc(dbapi_conn, _record):
    """Pin every DB connection to UTC so CURRENT_TIMESTAMP / NOW() store UTC
    regardless of the server's system timezone (fixes the timezone drift)."""
    cur = dbapi_conn.cursor()
    cur.execute("SET time_zone = '+00:00'")
    cur.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database(db_name: str) -> None:
    """Create the database if it does not exist (used by init + tests)."""
    server_engine = create_engine(settings.server_url())
    with server_engine.connect() as conn:
        conn.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        )
        conn.commit()
    server_engine.dispose()
