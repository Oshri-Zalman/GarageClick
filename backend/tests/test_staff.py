"""Tests for the staff operational summary endpoint (Stage 8.2)."""
from .helpers import (
    auth,
    create_customer,
    create_ticket,
    create_user,
    create_vehicle,
    token_for,
)


def ctx():
    manager = create_user(username="mgr", role="Manager")
    secretary = create_user(username="sec", role="Secretary")
    mechanic = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {"manager": manager, "secretary": secretary, "mechanic": mechanic, "vehicle": vehicle}


class TestStaffSummary:
    def test_manager_and_secretary_allowed(self, client):
        c = ctx()
        for who in ("manager", "secretary"):
            res = client.get("/api/staff/tickets/summary", headers=auth(token_for(c[who])))
            assert res.status_code == 200

    def test_mechanic_forbidden(self, client):
        c = ctx()
        res = client.get("/api/staff/tickets/summary", headers=auth(token_for(c["mechanic"])))
        assert res.status_code == 403

    def test_requires_auth(self, client):
        assert client.get("/api/staff/tickets/summary").status_code == 401

    def test_counts(self, client):
        c = ctx()
        v, m, mech = c["vehicle"]["id"], c["manager"]["id"], c["mechanic"]["id"]
        create_ticket(v, mech, m, status="Pending")
        create_ticket(v, mech, m, status="In Progress")
        create_ticket(v, mech, m, status="Completed")

        body = client.get("/api/staff/tickets/summary",
                          headers=auth(token_for(c["secretary"]))).json()
        assert body["total_pending"] == 1
        assert body["total_in_progress"] == 1
        assert body["total_completed"] == 1
        # No per-employee performance data is exposed here.
        assert "by_employee" not in body
