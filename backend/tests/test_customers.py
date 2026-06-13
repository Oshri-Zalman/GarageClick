"""Integration tests for customer routes."""
from .helpers import auth, create_user, token_for


def tokens():
    mechanic = token_for(create_user(username="mech", role="Mechanic"))
    manager = token_for(create_user(username="mgr", role="Manager"))
    return mechanic, manager


class TestCreateCustomer:
    def test_create_any_role(self, client):
        mechanic, _ = tokens()
        res = client.post("/api/customers", headers=auth(mechanic),
                          json={"full_name": "דן כהן", "phone_number": "0501234567"})
        assert res.status_code == 201
        assert res.json()["full_name"] == "דן כהן"
        assert "id" in res.json()

    def test_unauthenticated_401(self, client):
        res = client.post("/api/customers",
                          json={"full_name": "דן", "phone_number": "0501234567"})
        assert res.status_code == 401

    def test_missing_fields_422(self, client):
        mechanic, _ = tokens()
        res = client.post("/api/customers", headers=auth(mechanic),
                          json={"full_name": "דן"})
        assert res.status_code == 422


class TestSearchCustomers:
    def test_find_by_plate(self, client):
        mechanic, manager = tokens()
        created = client.post("/api/customers", headers=auth(manager),
                              json={"full_name": "דן כהן", "phone_number": "0501234567"})
        client.post("/api/vehicles", headers=auth(manager), json={
            "customer_id": created.json()["id"], "license_plate": "123-456",
            "manufacturer": "Volkswagen", "model": "Golf", "year": 2018,
        })
        res = client.get("/api/customers/search",
                         params={"license_plate": "123-456"}, headers=auth(mechanic))
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["full_name"] == "דן כהן"
        assert body[0]["vehicles"][0]["license_plate"] == "123-456"

    def test_missing_query_400(self, client):
        # Both license_plate and phone are optional now; providing neither is a
        # clear 400 ("provide a license_plate or phone").
        mechanic, _ = tokens()
        res = client.get("/api/customers/search", headers=auth(mechanic))
        assert res.status_code == 400
