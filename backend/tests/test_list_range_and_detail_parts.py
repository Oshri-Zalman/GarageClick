"""Item 4: date-range filter on the ticket/archive list.
Item 6: parts_used in the ticket detail (for the floating card)."""
from datetime import datetime

from .helpers import (
    auth,
    create_customer,
    create_part,
    create_ticket,
    create_user,
    create_vehicle,
    token_for,
)

OLD = datetime(2020, 1, 1, 10, 0, 0)
RECENT = datetime(2026, 6, 1, 10, 0, 0)
RANGE_START = "2026-01-01"


def ctx():
    manager = create_user(username="mgr", role="Manager")
    mech = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {"manager": manager, "mech": mech, "vehicle": vehicle}


class TestListDateRange:
    def test_range_filters_list(self, client):
        c = ctx()
        v, m, mech = c["vehicle"]["id"], c["manager"]["id"], c["mech"]["id"]
        old = create_ticket(v, mech, m, created_at=OLD)["id"]
        recent = create_ticket(v, mech, m, created_at=RECENT)["id"]

        body = client.get("/api/tickets", params={"start_date": RANGE_START},
                          headers=auth(token_for(c["manager"]))).json()
        ids = {t["id"] for t in body["items"]}
        assert recent in ids
        assert old not in ids

    def test_archive_with_date_range(self, client):
        c = ctx()
        v, m, mech = c["vehicle"]["id"], c["manager"]["id"], c["mech"]["id"]
        old = create_ticket(v, mech, m, status="Completed", created_at=OLD,
                            started_at=OLD, completed_at=OLD)["id"]
        recent = create_ticket(v, mech, m, status="Completed", created_at=RECENT,
                               started_at=RECENT, completed_at=RECENT)["id"]
        for tid in (old, recent):
            client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))

        body = client.get("/api/tickets",
                          params={"archived_only": "true", "start_date": RANGE_START},
                          headers=auth(token_for(c["manager"]))).json()
        ids = {t["id"] for t in body["items"]}
        assert recent in ids and old not in ids


class TestDetailPartsUsed:
    def test_detail_includes_parts_used(self, client):
        c = ctx()
        token = token_for(c["manager"])
        brakes = create_part(part_name="Brakes", part_code="BRK-9", quantity_current=10)
        created = client.post("/api/tickets", headers=auth(token), json={
            "vehicle_id": c["vehicle"]["id"], "assigned_mechanic_id": c["mech"]["id"],
            "description": "x", "parts": [{"part_id": brakes["id"], "quantity": 2}]})
        tid = created.json()["id"]

        detail = client.get(f"/api/tickets/{tid}", headers=auth(token)).json()
        assert "parts_used" in detail
        assert len(detail["parts_used"]) == 1
        assert detail["parts_used"][0]["part_name"] == "Brakes"
        assert detail["parts_used"][0]["quantity_used"] == 2

    def test_detail_no_parts_is_empty_list(self, client):
        c = ctx()
        token = token_for(c["manager"])
        created = client.post("/api/tickets", headers=auth(token), json={
            "vehicle_id": c["vehicle"]["id"], "assigned_mechanic_id": c["mech"]["id"],
            "description": "x"})
        detail = client.get(f"/api/tickets/{created.json()['id']}", headers=auth(token)).json()
        assert detail["parts_used"] == []
