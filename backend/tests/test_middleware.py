"""Tests for the authenticate / authorize dependencies."""
from .helpers import auth, create_customer, create_user, token_for


def role_tokens():
    return (
        token_for(create_user(username="mgr", role="Manager")),
        token_for(create_user(username="sec", role="Secretary")),
        token_for(create_user(username="mech", role="Mechanic")),
    )


class TestAuthenticate:
    def test_no_token_401(self, client):
        assert client.get("/api/customers").status_code == 401

    def test_malformed_header_401(self, client):
        res = client.get("/api/customers", headers={"Authorization": "Token abc"})
        assert res.status_code == 401

    def test_forged_token_401(self, client):
        res = client.get("/api/customers", headers=auth("aaa.bbb.ccc"))
        assert res.status_code == 401


class TestAuthorizeStaffRoutes:
    # GET /api/customers (list all) is Manager + Secretary only.
    def test_manager_allowed(self, client):
        mgr, _, _ = role_tokens()
        assert client.get("/api/customers", headers=auth(mgr)).status_code == 200

    def test_secretary_allowed(self, client):
        _, sec, _ = role_tokens()
        assert client.get("/api/customers", headers=auth(sec)).status_code == 200

    def test_mechanic_forbidden(self, client):
        _, _, mech = role_tokens()
        assert client.get("/api/customers", headers=auth(mech)).status_code == 403

    def test_mechanic_cannot_update_customer(self, client):
        _, _, mech = role_tokens()
        customer = create_customer()
        res = client.put(f"/api/customers/{customer['id']}", headers=auth(mech),
                         json={"full_name": "Hacker"})
        assert res.status_code == 403


class TestAuthorizeSharedRoutes:
    def test_mechanic_can_create_customer(self, client):
        _, _, mech = role_tokens()
        res = client.post("/api/customers", headers=auth(mech),
                          json={"full_name": "דן", "phone_number": "0501234567"})
        assert res.status_code == 201
