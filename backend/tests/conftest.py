"""Pytest setup: force the isolated test DB BEFORE importing the app, create
the schema once, and reset all tables between tests."""
import os

# Must run before any `app.*` import so the engine binds to the test database.
os.environ["DB_NAME"] = os.environ.get("DB_NAME_TEST", "garageclick_test")
# 32+ byte secret keeps PyJWT from emitting InsecureKeyLengthWarning during tests.
os.environ.setdefault("JWT_SECRET", "test_secret_at_least_32_bytes_long_xx")
# Force the mock notifier so tests NEVER make real Twilio/network calls.
os.environ["NOTIFICATIONS_PROVIDER"] = "mock"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import models  # noqa: E402,F401  (registers tables on Base.metadata)
from app import security  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import Base, engine, ensure_database  # noqa: E402
from app.main import app  # noqa: E402
from app.services import notifications  # noqa: E402

# Rebuild the test schema from the models so column changes are always applied
# (create_all alone won't ALTER an existing table). Safe — it's the test DB.
ensure_database(settings.DB_NAME)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

# Seed the reference catalog once (it is not wiped between tests).
from app.init_db import seed_catalog  # noqa: E402
seed_catalog()

_TABLES = [
    "audit_log",
    "ticket_parts_used",
    "tickets_work",
    "parts_inventory",
    "vehicles",
    "customers",
    "users",
]


@pytest.fixture(autouse=True)
def reset_db():
    """Wipe all tables before each test for isolation."""
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for tbl in _TABLES:
            conn.execute(text(f"DELETE FROM {tbl}"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    notifications.reset()  # clear the mock WhatsApp outbox
    security.clear_revoked()  # clear the token denylist
    yield


@pytest.fixture
def client():
    return TestClient(app)
