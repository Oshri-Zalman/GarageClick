"""Tests for archiving (closing) a completed ticket off the board."""
from datetime import datetime

from app.database import SessionLocal
from app.models import AuditLog

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
    mech = create_user(username="mech", role="Mechanic")
    other = create_user(username="mech2", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {"manager": manager, "mech": mech, "other": other,
            "customer": customer, "vehicle": vehicle}


def _completed_ticket(c):
    return create_ticket(c["vehicle"]["id"], c["mech"]["id"], c["manager"]["id"],
                         status="Completed", started_at=datetime.now(),
                         completed_at=datetime.now())


class TestArchive:
    def test_archive_completed_ticket(self, client):
        c = ctx()
        tid = _completed_ticket(c)["id"]
        res = client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
        assert res.status_code == 200
        assert res.json()["archived_at"] is not None

    def test_archived_leaves_board_but_stays_in_history(self, client):
        c = ctx()
        tid = _completed_ticket(c)["id"]
        client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))

        # Gone from the active board (default list).
        board = client.get("/api/tickets", headers=auth(token_for(c["manager"]))).json()
        assert tid not in {t["id"] for t in board["items"]}

        # Visible with include_archived=true.
        witharch = client.get("/api/tickets", params={"include_archived": "true"},
                              headers=auth(token_for(c["manager"]))).json()
        assert tid in {t["id"] for t in witharch["items"]}

        # Still in the vehicle's history.
        hist = client.get(f"/api/vehicles/{c['vehicle']['id']}/tickets",
                          headers=auth(token_for(c["manager"]))).json()
        assert tid in {t["id"] for t in hist}

    def test_cannot_archive_non_completed(self, client):
        c = ctx()
        tid = create_ticket(c["vehicle"]["id"], c["mech"]["id"], c["manager"]["id"],
                            status="Pending")["id"]
        res = client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
        assert res.status_code == 409

    def test_cannot_archive_twice(self, client):
        c = ctx()
        tid = _completed_ticket(c)["id"]
        client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
        res = client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
        assert res.status_code == 409

    def test_mechanic_can_archive_own(self, client):
        c = ctx()
        tid = _completed_ticket(c)["id"]
        res = client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["mech"])))
        assert res.status_code == 200

    def test_other_mechanic_forbidden(self, client):
        c = ctx()
        tid = _completed_ticket(c)["id"]
        res = client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["other"])))
        assert res.status_code == 403

    def test_unknown_ticket_404(self, client):
        c = ctx()
        res = client.post("/api/tickets/999999/archive", headers=auth(token_for(c["manager"])))
        assert res.status_code == 404

    def test_archive_writes_audit(self, client):
        c = ctx()
        tid = _completed_ticket(c)["id"]
        client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
        with SessionLocal() as db:
            rows = db.query(AuditLog).filter(
                AuditLog.action == "ticket_archived", AuditLog.resource_id == tid
            ).all()
        assert len(rows) == 1
