"""Tests for the parts consumption report (FR-7.6)."""
from .helpers import (
    auth,
    create_customer,
    create_part,
    create_user,
    create_vehicle,
    token_for,
)


def ctx(client):
    manager = create_user(username="mgr", role="Manager")
    secretary = create_user(username="sec", role="Secretary")
    mechanic = create_user(username="mech", role="Mechanic", full_name="Mech One")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456",
                             manufacturer="Volkswagen")
    return {
        "manager": manager, "secretary": secretary, "mechanic": mechanic,
        "vehicle": vehicle, "mtoken": token_for(manager),
    }


def open_ticket_with_parts(client, c, parts):
    return client.post("/api/tickets", headers=auth(c["mtoken"]), json={
        "vehicle_id": c["vehicle"]["id"], "assigned_mechanic_id": c["mechanic"]["id"],
        "description": "x", "parts": parts})


class TestConsumptionReport:
    def test_totals_and_breakdowns(self, client):
        c = ctx(client)
        brakes = create_part(part_name="Brakes", quantity_current=10)
        oil = create_part(part_name="Oil", part_code="OIL-1", quantity_current=10)
        open_ticket_with_parts(client, c, [
            {"part_id": brakes["id"], "quantity": 2},
            {"part_id": oil["id"], "quantity": 3},
        ])

        res = client.get("/api/parts/reports/consumption", headers=auth(c["mtoken"]))
        assert res.status_code == 200
        body = res.json()
        assert body["total_parts_used"] == 5

        vw = next(r for r in body["by_vehicle_manufacturer"] if r["manufacturer"] == "Volkswagen")
        assert vw["parts_used"] == 5

        emp = next(r for r in body["by_employee"] if r["mechanic_id"] == c["mechanic"]["id"])
        assert emp["parts_used"] == 5
        assert sum(d["parts_used"] for d in body["by_day"]) == 5

        # by_part: exactly which part and how many.
        by_part = {p["part_name"]: p["parts_used"] for p in body["by_part"]}
        assert by_part["Brakes"] == 2
        assert by_part["Oil"] == 3

    def test_secretary_allowed(self, client):
        c = ctx(client)
        res = client.get("/api/parts/reports/consumption",
                         headers=auth(token_for(c["secretary"])))
        assert res.status_code == 200

    def test_mechanic_forbidden(self, client):
        c = ctx(client)
        res = client.get("/api/parts/reports/consumption",
                         headers=auth(token_for(c["mechanic"])))
        assert res.status_code == 403

    def test_bad_range_400(self, client):
        c = ctx(client)
        res = client.get("/api/parts/reports/consumption",
                         params={"start_date": "2026-06-10", "end_date": "2026-06-01"},
                         headers=auth(c["mtoken"]))
        assert res.status_code == 400
