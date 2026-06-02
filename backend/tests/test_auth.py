"""Integration tests for the auth routes."""
from .helpers import auth, create_user


class TestLogin:
    def test_returns_token_on_correct_credentials(self, client):
        create_user(username="manager1", password="pass1234", role="Manager",
                    full_name="Mira Manager")
        res = client.post("/api/auth/login",
                          json={"username": "manager1", "password": "pass1234"})
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body["token"], str)
        assert body["role"] == "Manager"
        assert body["full_name"] == "Mira Manager"
        assert "user_id" in body

    def test_wrong_password(self, client):
        create_user(username="mech1", password="correct", role="Mechanic")
        res = client.post("/api/auth/login",
                          json={"username": "mech1", "password": "WRONG"})
        assert res.status_code == 401

    def test_unknown_user(self, client):
        res = client.post("/api/auth/login",
                          json={"username": "ghost", "password": "whatever"})
        assert res.status_code == 401

    def test_inactive_user(self, client):
        create_user(username="gone", password="pass1234", role="Secretary", is_active=False)
        res = client.post("/api/auth/login",
                          json={"username": "gone", "password": "pass1234"})
        assert res.status_code == 401

    def test_missing_fields_422(self, client):
        res = client.post("/api/auth/login", json={"username": "x"})
        assert res.status_code == 422


class TestVerifyToken:
    def test_valid_token(self, client):
        create_user(username="sec1", password="pass1234", role="Secretary")
        login = client.post("/api/auth/login",
                            json={"username": "sec1", "password": "pass1234"})
        token = login.json()["token"]
        res = client.get("/api/auth/verify-token", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["valid"] is True
        assert res.json()["role"] == "Secretary"

    def test_no_token(self, client):
        assert client.get("/api/auth/verify-token").status_code == 401

    def test_garbage_token(self, client):
        res = client.get("/api/auth/verify-token", headers=auth("not.a.jwt"))
        assert res.status_code == 401
