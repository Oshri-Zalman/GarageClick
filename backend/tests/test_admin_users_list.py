"""Tests for GET /api/admin/users (Manager-only user listing, Stage 9)."""
from .helpers import auth, create_user, token_for


def seed():
    return {
        "manager": create_user(username="mgr", role="Manager", full_name="Mira Manager"),
        "secretary": create_user(username="sec", role="Secretary"),
        "mechanic": create_user(username="mech", role="Mechanic"),
        "inactive": create_user(username="ghost", role="Mechanic", is_active=False),
    }


class TestListUsers:
    def test_manager_gets_all_users(self, client):
        u = seed()
        res = client.get("/api/admin/users", headers=auth(token_for(u["manager"])))
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 4  # incl. the inactive one
        usernames = {row["username"] for row in body}
        assert {"mgr", "sec", "mech", "ghost"} <= usernames

    def test_fields_include_username_and_is_active(self, client):
        u = seed()
        res = client.get("/api/admin/users", headers=auth(token_for(u["manager"])))
        row = res.json()[0]
        assert set(row.keys()) == {
            "id", "username", "role", "full_name", "email", "is_active", "created_at",
        }
        assert "password_hash" not in row

    def test_inactive_user_present_with_flag(self, client):
        u = seed()
        res = client.get("/api/admin/users", headers=auth(token_for(u["manager"])))
        ghost = next(r for r in res.json() if r["username"] == "ghost")
        assert ghost["is_active"] is False

    def test_secretary_forbidden(self, client):
        u = seed()
        res = client.get("/api/admin/users", headers=auth(token_for(u["secretary"])))
        assert res.status_code == 403

    def test_mechanic_forbidden(self, client):
        u = seed()
        res = client.get("/api/admin/users", headers=auth(token_for(u["mechanic"])))
        assert res.status_code == 403

    def test_requires_auth(self, client):
        assert client.get("/api/admin/users").status_code == 401
