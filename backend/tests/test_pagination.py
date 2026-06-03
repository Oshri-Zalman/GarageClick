"""Tests for paginated list endpoints."""
from .helpers import auth, create_customer, create_user, create_vehicle, token_for


def manager_token():
    return token_for(create_user(username="mgr", role="Manager"))


class TestTicketsPagination:
    def test_envelope_and_paging(self, client):
        manager = create_user(username="mgr", role="Manager")
        mech = create_user(username="mech", role="Mechanic")
        customer = create_customer()
        vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
        mtoken = token_for(manager)

        # Create 3 tickets (same vehicle is fine).
        for _ in range(3):
            r = client.post("/api/tickets", headers=auth(mtoken), json={
                "vehicle_id": vehicle["id"], "assigned_mechanic_id": mech["id"],
                "description": "x"})
            assert r.status_code == 201

        page1 = client.get("/api/tickets", params={"page": 1, "limit": 2},
                           headers=auth(mtoken)).json()
        assert page1["total"] == 3
        assert page1["page"] == 1
        assert page1["limit"] == 2
        assert len(page1["items"]) == 2

        page2 = client.get("/api/tickets", params={"page": 2, "limit": 2},
                           headers=auth(mtoken)).json()
        assert len(page2["items"]) == 1

        # No overlap between pages.
        ids1 = {t["id"] for t in page1["items"]}
        ids2 = {t["id"] for t in page2["items"]}
        assert ids1.isdisjoint(ids2)

    def test_invalid_limit_422(self, client):
        res = client.get("/api/tickets", params={"limit": 0}, headers=auth(manager_token()))
        assert res.status_code == 422


class TestCustomersPagination:
    def test_envelope(self, client):
        token = manager_token()
        for i in range(3):
            client.post("/api/customers", headers=auth(token),
                        json={"full_name": f"C{i}", "phone_number": "0501234567"})
        body = client.get("/api/customers", params={"limit": 2}, headers=auth(token)).json()
        assert body["total"] == 3
        assert len(body["items"]) == 2
