"""Tests for the demo seed script."""
from app.database import SessionLocal
from app.models import Customer, PartInventory, User
from app.seed import DEMO_PASSWORD, seed_demo_data


class TestSeed:
    def test_seed_creates_demo_data(self, client):
        result = seed_demo_data()
        assert set(result["users"]) == {"manager", "secretary", "mechanic"}

        with SessionLocal() as db:
            assert db.query(User).count() == 3
            assert db.query(Customer).count() >= 1
            assert db.query(PartInventory).count() >= 2

    def test_seed_is_idempotent(self, client):
        seed_demo_data()
        seed_demo_data()  # second run must not duplicate
        with SessionLocal() as db:
            assert db.query(User).filter(User.username == "manager").count() == 1

    def test_demo_users_can_login(self, client):
        seed_demo_data()
        res = client.post("/api/auth/login",
                          json={"username": "manager", "password": DEMO_PASSWORD})
        assert res.status_code == 200
        assert res.json()["role"] == "Manager"
