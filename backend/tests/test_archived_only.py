"""Item 9: GET /api/tickets?archived_only=true returns only closed/archived tickets."""
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
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {"manager": manager, "mech": mech, "vehicle": vehicle}


def _completed(c):
    return create_ticket(c["vehicle"]["id"], c["mech"]["id"], c["manager"]["id"],
                         status="Completed", started_at=datetime.now(),
                         completed_at=datetime.now())["id"]


class TestArchivedOnly:
    def test_returns_only_archived(self, client):
        c = ctx()
        active = _completed(c)
        archived = _completed(c)
        client.post(f"/api/tickets/{archived}/archive", headers=auth(token_for(c["manager"])))

        body = client.get("/api/tickets", params={"archived_only": "true"},
                          headers=auth(token_for(c["manager"]))).json()
        ids = {t["id"] for t in body["items"]}
        assert archived in ids
        assert active not in ids
        assert all(t["archived_at"] is not None for t in body["items"])

    def test_mechanic_scoped_archived_only(self, client):
        c = ctx()
        tid = _completed(c)
        client.post(f"/api/tickets/{tid}/archive", headers=auth(token_for(c["manager"])))
        body = client.get("/api/tickets", params={"archived_only": "true"},
                          headers=auth(token_for(c["mech"]))).json()
        assert tid in {t["id"] for t in body["items"]}
