"""Confirms the core rule: a Mechanic sees ONLY their own board; Manager and
Secretary see (and can act on) everyone's."""
from .helpers import (
    auth,
    create_customer,
    create_ticket,
    create_user,
    create_vehicle,
    token_for,
)


def visibility_ctx():
    manager = create_user(username="mgr", role="Manager")
    secretary = create_user(username="sec", role="Secretary")
    mech1 = create_user(username="mech1", role="Mechanic")
    mech2 = create_user(username="mech2", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    ticket_a = create_ticket(vehicle["id"], mech1["id"], manager["id"])  # mech1's
    ticket_b = create_ticket(vehicle["id"], mech2["id"], manager["id"])  # mech2's
    return {
        "manager": manager, "secretary": secretary, "mech1": mech1, "mech2": mech2,
        "ticket_a": ticket_a, "ticket_b": ticket_b,
    }


class TestListVisibility:
    def test_mechanic_sees_only_own(self, client):
        ctx = visibility_ctx()
        res = client.get("/api/tickets", headers=auth(token_for(ctx["mech1"])))
        assert res.status_code == 200
        ids = {t["id"] for t in res.json()}
        assert ids == {ctx["ticket_a"]["id"]}  # NOT ticket_b

    def test_manager_sees_all(self, client):
        ctx = visibility_ctx()
        res = client.get("/api/tickets", headers=auth(token_for(ctx["manager"])))
        ids = {t["id"] for t in res.json()}
        assert ids == {ctx["ticket_a"]["id"], ctx["ticket_b"]["id"]}

    def test_secretary_sees_all(self, client):
        ctx = visibility_ctx()
        res = client.get("/api/tickets", headers=auth(token_for(ctx["secretary"])))
        ids = {t["id"] for t in res.json()}
        assert ids == {ctx["ticket_a"]["id"], ctx["ticket_b"]["id"]}


class TestSingleTicketVisibility:
    def test_mechanic_can_open_own(self, client):
        ctx = visibility_ctx()
        res = client.get(f"/api/tickets/{ctx['ticket_a']['id']}",
                         headers=auth(token_for(ctx["mech1"])))
        assert res.status_code == 200

    def test_mechanic_blocked_from_others(self, client):
        ctx = visibility_ctx()
        res = client.get(f"/api/tickets/{ctx['ticket_b']['id']}",
                         headers=auth(token_for(ctx["mech1"])))
        assert res.status_code == 403

    def test_manager_can_open_any(self, client):
        ctx = visibility_ctx()
        res = client.get(f"/api/tickets/{ctx['ticket_b']['id']}",
                         headers=auth(token_for(ctx["manager"])))
        assert res.status_code == 200

    def test_mechanic_cannot_edit_others_status(self, client):
        ctx = visibility_ctx()
        res = client.patch(f"/api/tickets/{ctx['ticket_b']['id']}/status",
                           headers=auth(token_for(ctx["mech1"])),
                           json={"new_status": "In Progress"})
        assert res.status_code == 403
