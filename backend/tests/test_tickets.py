"""Integration tests for ticket creation + status state machine."""
import re

from app.models import Customer

from .helpers import (
    auth,
    count,
    create_customer,
    create_user,
    create_vehicle,
    token_for,
)


def build_ctx():
    ctx = {
        "manager": create_user(username="mgr", role="Manager"),
        "secretary": create_user(username="sec", role="Secretary"),
        "mechanic": create_user(username="mech", role="Mechanic"),
        "other_mechanic": create_user(username="mech2", role="Mechanic"),
    }
    customer = create_customer()
    ctx["vehicle"] = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    ctx["tokens"] = {k: token_for(v) for k, v in ctx.items() if k != "vehicle"}
    return ctx


def open_ticket(client, ctx, token_role="secretary", **overrides):
    payload = {
        "vehicle_id": ctx["vehicle"]["id"],
        "assigned_mechanic_id": ctx["mechanic"]["id"],
        "description": "החלפת בלמים",
    }
    payload.update(overrides)
    return client.post("/api/tickets", headers=auth(ctx["tokens"][token_role]), json=payload)


class TestCreateScenarioA:
    def test_secretary_opens_ticket(self, client):
        ctx = build_ctx()
        res = open_ticket(client, ctx)
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "Pending"
        assert re.match(r"^TKT-\d{5}$", body["ticket_number"])
        assert body["vehicle_id"] == ctx["vehicle"]["id"]
        assert body["assigned_mechanic_id"] == ctx["mechanic"]["id"]
        assert body["created_by_id"] == ctx["secretary"]["id"]
        assert body["license_plate"] == "123-456"

    def test_unauthenticated_401(self, client):
        ctx = build_ctx()
        res = client.post("/api/tickets", json={
            "vehicle_id": ctx["vehicle"]["id"],
            "assigned_mechanic_id": ctx["mechanic"]["id"], "description": "x"})
        assert res.status_code == 401

    def test_missing_description_422(self, client):
        ctx = build_ctx()
        res = client.post("/api/tickets", headers=auth(ctx["tokens"]["secretary"]),
                          json={"vehicle_id": ctx["vehicle"]["id"],
                                "assigned_mechanic_id": ctx["mechanic"]["id"]})
        assert res.status_code == 422

    def test_neither_scenario_400(self, client):
        ctx = build_ctx()
        res = client.post("/api/tickets", headers=auth(ctx["tokens"]["secretary"]),
                          json={"assigned_mechanic_id": ctx["mechanic"]["id"],
                                "description": "x"})
        assert res.status_code == 400

    def test_nonexistent_vehicle_400(self, client):
        ctx = build_ctx()
        res = open_ticket(client, ctx, vehicle_id=999999)
        assert res.status_code == 400


class TestMechanicSelfAssignment:
    def test_mechanic_self_ok(self, client):
        ctx = build_ctx()
        res = open_ticket(client, ctx, token_role="mechanic",
                          assigned_mechanic_id=ctx["mechanic"]["id"])
        assert res.status_code == 201

    def test_mechanic_assign_other_403(self, client):
        ctx = build_ctx()
        res = open_ticket(client, ctx, token_role="mechanic",
                          assigned_mechanic_id=ctx["other_mechanic"]["id"])
        assert res.status_code == 403


class TestCreateScenarioB:
    def test_creates_customer_vehicle_ticket(self, client):
        ctx = build_ctx()
        res = client.post("/api/tickets", headers=auth(ctx["tokens"]["manager"]), json={
            "license_plate": "999-999",
            "new_customer": {"full_name": "דוד", "phone_number": "050987654321"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": ctx["mechanic"]["id"], "description": "החלפת שמן",
        })
        assert res.status_code == 201
        body = res.json()
        assert body["license_plate"] == "999-999"
        assert body["manufacturer"] == "BMW"
        assert body["customer_name"] == "דוד"

        search = client.get("/api/vehicles/search", params={"license_plate": "999-999"},
                            headers=auth(ctx["tokens"]["manager"]))
        assert search.json()["model"] == "320i"

    def test_duplicate_plate_rolls_back(self, client):
        ctx = build_ctx()
        res = client.post("/api/tickets", headers=auth(ctx["tokens"]["manager"]), json={
            "license_plate": "123-456",  # already used
            "new_customer": {"full_name": "כפיל", "phone_number": "0500000000"},
            "new_vehicle": {"manufacturer": "Kia", "model": "Niro", "year": 2021},
            "assigned_mechanic_id": ctx["mechanic"]["id"], "description": "x",
        })
        assert res.status_code == 409
        # Rolled back: "כפיל" must not exist.
        assert count(Customer) == 1  # only the seeded customer


class TestStatusStateMachine:
    def _open(self, client, ctx):
        return open_ticket(client, ctx).json()["id"]

    def test_pending_to_in_progress(self, client):
        ctx = build_ctx()
        tid = self._open(client, ctx)
        res = client.patch(f"/api/tickets/{tid}/status",
                           headers=auth(ctx["tokens"]["mechanic"]),
                           json={"new_status": "In Progress"})
        assert res.status_code == 200
        assert res.json()["status"] == "In Progress"
        assert res.json()["started_at"] is not None

    def test_full_path_to_completed(self, client):
        ctx = build_ctx()
        tid = self._open(client, ctx)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["mechanic"]),
                     json={"new_status": "In Progress"})
        res = client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["mechanic"]),
                           json={"new_status": "Completed", "confirmation": True})
        assert res.status_code == 200
        assert res.json()["status"] == "Completed"
        assert res.json()["completed_at"] is not None

    def test_complete_without_confirmation_400(self, client):
        ctx = build_ctx()
        tid = self._open(client, ctx)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["mechanic"]),
                     json={"new_status": "In Progress"})
        res = client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["mechanic"]),
                           json={"new_status": "Completed"})
        assert res.status_code == 400

    def test_illegal_skip_409(self, client):
        ctx = build_ctx()
        tid = self._open(client, ctx)
        res = client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["manager"]),
                           json={"new_status": "Completed", "confirmation": True})
        assert res.status_code == 409

    def test_completed_is_terminal_409(self, client):
        ctx = build_ctx()
        tid = self._open(client, ctx)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["manager"]),
                     json={"new_status": "In Progress"})
        client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["manager"]),
                     json={"new_status": "Completed", "confirmation": True})
        res = client.patch(f"/api/tickets/{tid}/status", headers=auth(ctx["tokens"]["manager"]),
                           json={"new_status": "In Progress"})
        assert res.status_code == 409

    def test_mechanic_cannot_touch_others_ticket_403(self, client):
        ctx = build_ctx()
        tid = self._open(client, ctx)
        res = client.patch(f"/api/tickets/{tid}/status",
                           headers=auth(ctx["tokens"]["other_mechanic"]),
                           json={"new_status": "In Progress"})
        assert res.status_code == 403

    def test_unknown_ticket_404(self, client):
        ctx = build_ctx()
        res = client.patch("/api/tickets/999999/status",
                           headers=auth(ctx["tokens"]["manager"]),
                           json={"new_status": "In Progress"})
        assert res.status_code == 404
