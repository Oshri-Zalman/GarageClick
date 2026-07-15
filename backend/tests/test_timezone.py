"""Timestamps returned by the API must be UTC-aware (carry a timezone offset),
so the frontend can convert them to Israel local time correctly."""
import re

from app.seed import DEMO_PARTS, seed_parts

from .helpers import auth, create_customer, create_user, create_vehicle, token_for

# ISO datetime that ends with an explicit UTC marker: 'Z' or '+00:00'.
_UTC_SUFFIX = re.compile(r"(Z|\+00:00)$")


def test_ticket_timestamps_are_utc_aware(client):
    manager = create_user(username="mgr", role="Manager")
    mech = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    token = token_for(manager)

    created = client.post("/api/tickets", headers=auth(token), json={
        "vehicle_id": vehicle["id"], "assigned_mechanic_id": mech["id"],
        "description": "x"})
    assert created.status_code == 201
    assert _UTC_SUFFIX.search(created.json()["created_at"]), created.json()["created_at"]

    # last_login (set on login) is also UTC-aware in the employees report.
    client.post("/api/auth/login", json={"username": "mech", "password": "secret123"})
    emps = client.get("/api/admin/employees", headers=auth(token)).json()
    row = next(e for e in emps if e["id"] == mech["id"])
    assert row["last_login"] is not None
    assert _UTC_SUFFIX.search(row["last_login"])


class TestSeedParts:
    def test_seeds_diverse_parts(self, client):
        added = seed_parts()
        assert added == len(DEMO_PARTS) == 20

    def test_five_parts_are_general(self, client):
        seed_parts()
        from app.database import SessionLocal
        from app.models import PartInventory
        with SessionLocal() as db:
            general = db.query(PartInventory).filter(
                PartInventory.manufacturer.is_(None)
            ).count()
        assert general == 5

    def test_idempotent(self, client):
        seed_parts()
        assert seed_parts() == 0  # second run adds nothing
