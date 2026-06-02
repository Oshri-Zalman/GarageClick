"""Integration tests for vehicle routes."""
from .helpers import auth, create_customer, create_user, token_for


def setup_ctx():
    token = token_for(create_user(username="mech", role="Mechanic"))
    customer = create_customer(full_name="דן", phone_number="0501234567")
    return token, customer


class TestCreateVehicle:
    def test_create_for_existing_customer(self, client):
        token, customer = setup_ctx()
        res = client.post("/api/vehicles", headers=auth(token), json={
            "customer_id": customer["id"], "license_plate": "999-999",
            "manufacturer": "BMW", "model": "320i", "year": 2020,
        })
        assert res.status_code == 201
        assert res.json()["manufacturer"] == "BMW"

    def test_unauthenticated_401(self, client):
        _, customer = setup_ctx()
        res = client.post("/api/vehicles", json={
            "customer_id": customer["id"], "license_plate": "111-111",
            "manufacturer": "Mazda", "model": "3",
        })
        assert res.status_code == 401

    def test_duplicate_plate_409(self, client):
        token, customer = setup_ctx()
        body = {"customer_id": customer["id"], "license_plate": "DUP-001",
                "manufacturer": "Kia", "model": "Niro", "year": 2021}
        client.post("/api/vehicles", headers=auth(token), json=body)
        res = client.post("/api/vehicles", headers=auth(token), json=body)
        assert res.status_code == 409

    def test_nonexistent_customer_400(self, client):
        token, _ = setup_ctx()
        res = client.post("/api/vehicles", headers=auth(token), json={
            "customer_id": 999999, "license_plate": "777-777",
            "manufacturer": "Audi", "model": "A3",
        })
        assert res.status_code == 400


class TestSearchVehicle:
    def test_found(self, client):
        token, customer = setup_ctx()
        client.post("/api/vehicles", headers=auth(token), json={
            "customer_id": customer["id"], "license_plate": "123-456",
            "manufacturer": "Volkswagen", "model": "Golf", "year": 2018,
        })
        res = client.get("/api/vehicles/search",
                         params={"license_plate": "123-456"}, headers=auth(token))
        assert res.status_code == 200
        body = res.json()
        assert body["manufacturer"] == "Volkswagen"
        assert body["customer_name"] == "דן"
        assert body["customer_phone"] == "0501234567"

    def test_not_found(self, client):
        token, _ = setup_ctx()
        res = client.get("/api/vehicles/search",
                         params={"license_plate": "NOPE-000"}, headers=auth(token))
        assert res.status_code == 200
        assert res.json() == {"found": False}
