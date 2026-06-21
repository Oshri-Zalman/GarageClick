"""GET /api/tickets list must expose archived_at so the frontend "My Tickets"
history page can distinguish active vs archived (closed) tickets."""
from datetime import datetime

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
    return {"manager": manager, "mech": mech, "other": other, "vehicle": vehicle}


def _completed(c, assignee=None):
    return create_ticket(
        c["vehicle"]["id"], (assignee or c["mech"])["id"], c["manager"]["id"],
        status="Completed", started_at=datetime.now(), completed_at=datetime.now(),
    )["id"]


def _archive(client, c, tid):
    r = client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
    assert r.status_code == 200


class TestListArchivedAt:
    def test_default_active_ticket_has_archived_at_null(self, client):
        c = ctx()
        tid = _completed(c)
        body = client.get("/api/tickets", headers=auth(token_for(c["manager"]))).json()
        row = next(t for t in body["items"] if t["id"] == tid)
        assert "archived_at" in row
        assert row["archived_at"] is None

    def test_default_excludes_archived(self, client):
        c = ctx()
        tid = _completed(c)
        _archive(client, c, tid)
        body = client.get("/api/tickets", headers=auth(token_for(c["manager"]))).json()
        assert tid not in {t["id"] for t in body["items"]}

    def test_include_archived_returns_archived(self, client):
        c = ctx()
        tid = _completed(c)
        _archive(client, c, tid)
        body = client.get("/api/tickets", params={"include_archived": "true"},
                          headers=auth(token_for(c["manager"]))).json()
        assert tid in {t["id"] for t in body["items"]}

    def test_archived_row_has_non_null_archived_at(self, client):
        c = ctx()
        tid = _completed(c)
        _archive(client, c, tid)
        body = client.get("/api/tickets", params={"include_archived": "true"},
                          headers=auth(token_for(c["manager"]))).json()
        row = next(t for t in body["items"] if t["id"] == tid)
        assert row["archived_at"] is not None

    def test_active_row_archived_at_null_with_include_archived(self, client):
        c = ctx()
        active = _completed(c)        # not archived
        archived = _completed(c)
        _archive(client, c, archived)
        body = client.get("/api/tickets", params={"include_archived": "true"},
                          headers=auth(token_for(c["manager"]))).json()
        rows = {t["id"]: t for t in body["items"]}
        assert rows[active]["archived_at"] is None
        assert rows[archived]["archived_at"] is not None

    def test_mechanic_scoping_with_include_archived(self, client):
        c = ctx()
        mine = _completed(c, assignee=c["mech"])
        others = _completed(c, assignee=c["other"])
        body = client.get("/api/tickets", params={"include_archived": "true"},
                          headers=auth(token_for(c["mech"]))).json()
        ids = {t["id"] for t in body["items"]}
        assert mine in ids
        assert others not in ids  # still scoped to own
        # and archived_at is present on the row
        assert "archived_at" in next(t for t in body["items"] if t["id"] == mine)
