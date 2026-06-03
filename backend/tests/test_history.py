"""Tests for vehicle/customer ticket-history endpoints."""
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
    v1 = create_vehicle(customer_id=customer["id"], license_plate="111-111")
    v2 = create_vehicle(customer_id=customer["id"], license_plate="222-222")
    # Two tickets on v1, one on v2 (all same customer).
    create_ticket(v1["id"], mech["id"], manager["id"])
    create_ticket(v1["id"], mech["id"], manager["id"])
    create_ticket(v2["id"], mech["id"], manager["id"])
    return {"manager": manager, "mech": mech, "customer": customer, "v1": v1, "v2": v2}


class TestVehicleHistory:
    def test_returns_vehicle_tickets(self, client):
        c = ctx()
        res = client.get(f"/api/vehicles/{c['v1']['id']}/tickets",
                         headers=auth(token_for(c["manager"])))
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_unknown_vehicle_404(self, client):
        c = ctx()
        res = client.get("/api/vehicles/999999/tickets",
                         headers=auth(token_for(c["manager"])))
        assert res.status_code == 404

    def test_mechanic_forbidden(self, client):
        c = ctx()
        res = client.get(f"/api/vehicles/{c['v1']['id']}/tickets",
                         headers=auth(token_for(c["mech"])))
        assert res.status_code == 403


class TestCustomerHistory:
    def test_returns_all_customer_tickets(self, client):
        c = ctx()
        res = client.get(f"/api/customers/{c['customer']['id']}/tickets",
                         headers=auth(token_for(c["manager"])))
        assert res.status_code == 200
        assert len(res.json()) == 3  # across both vehicles

    def test_unknown_customer_404(self, client):
        c = ctx()
        res = client.get("/api/customers/999999/tickets",
                         headers=auth(token_for(c["manager"])))
        assert res.status_code == 404
