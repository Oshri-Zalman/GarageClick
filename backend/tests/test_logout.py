"""Tests for logout (token revocation) and last_login tracking."""
from app.database import SessionLocal
from app.models import User

from .helpers import auth, create_user


def _login(client, username, password):
    return client.post("/api/auth/login", json={"username": username, "password": password})


class TestLogout:
    def test_token_works_then_revoked_after_logout(self, client):
        create_user(username="bye", password="secret123", role="Secretary")
        token = _login(client, "bye", "secret123").json()["token"]

        # Valid before logout.
        assert client.get("/api/auth/verify-token", headers=auth(token)).status_code == 200

        # Logout revokes it.
        assert client.post("/api/auth/logout", headers=auth(token)).status_code == 200

        # Same token no longer works.
        assert client.get("/api/auth/verify-token", headers=auth(token)).status_code == 401

    def test_logout_requires_auth(self, client):
        assert client.post("/api/auth/logout").status_code == 401

    def test_other_tokens_unaffected(self, client):
        create_user(username="multi", password="secret123", role="Mechanic")
        t1 = _login(client, "multi", "secret123").json()["token"]
        t2 = _login(client, "multi", "secret123").json()["token"]

        client.post("/api/auth/logout", headers=auth(t1))
        # t1 revoked, t2 still valid (independent jti).
        assert client.get("/api/auth/verify-token", headers=auth(t1)).status_code == 401
        assert client.get("/api/auth/verify-token", headers=auth(t2)).status_code == 200


class TestLastLogin:
    def test_login_sets_last_login(self, client):
        user = create_user(username="stamp", password="secret123", role="Mechanic")
        with SessionLocal() as db:
            assert db.get(User, user["id"]).last_login is None

        _login(client, "stamp", "secret123")

        with SessionLocal() as db:
            assert db.get(User, user["id"]).last_login is not None
