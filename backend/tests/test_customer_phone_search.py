"""Tests for customer search by phone (Stage 6.1 follow-up)."""
from .helpers import auth, create_user, token_for


def staff_token():
    return token_for(create_user(username="mgr", role="Manager"))


def _make_customer(client, token, name, phone):
    return client.post("/api/customers", headers=auth(token),
                       json={"full_name": name, "phone_number": phone}).json()


class TestPhoneSearch:
    def test_exact_phone(self, client):
        token = staff_token()
        _make_customer(client, token, "דן", "0526861377")
        res = client.get("/api/customers/search", params={"phone": "0526861377"},
                         headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["full_name"] == "דן"

    def test_partial_phone(self, client):
        token = staff_token()
        _make_customer(client, token, "דן", "0526861377")
        res = client.get("/api/customers/search", params={"phone": "861377"},
                         headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_phone_with_separators_matches(self, client):
        token = staff_token()
        _make_customer(client, token, "דן", "0526861377")
        res = client.get("/api/customers/search", params={"phone": "052-686-1377"},
                         headers=auth(token))
        assert len(res.json()) == 1

    def test_no_match_returns_empty(self, client):
        token = staff_token()
        _make_customer(client, token, "דן", "0526861377")
        res = client.get("/api/customers/search", params={"phone": "0500000000"},
                         headers=auth(token))
        assert res.json() == []

    def test_requires_a_param(self, client):
        res = client.get("/api/customers/search", headers=auth(staff_token()))
        assert res.status_code == 400

    def test_plate_search_still_works(self, client):
        token = staff_token()
        cust = _make_customer(client, token, "דן", "0526861377")
        client.post("/api/vehicles", headers=auth(token), json={
            "customer_id": cust["id"], "license_plate": "123-456",
            "manufacturer": "VW", "model": "Golf", "year": 2018})
        res = client.get("/api/customers/search", params={"license_plate": "123-456"},
                         headers=auth(token))
        assert len(res.json()) == 1
