"""Tests for GET /api/mechanics (assignable mechanics for the ticket dropdown)."""
from .helpers import auth, create_user, token_for


def seed_users():
    """A mix of roles + an inactive mechanic to prove filtering."""
    return {
        "manager": create_user(username="mgr", role="Manager", full_name="Mira Manager"),
        "secretary": create_user(username="sec", role="Secretary", full_name="Sara Sec"),
        "mech1": create_user(username="mech1", role="Mechanic", full_name="David Cohen"),
        "mech2": create_user(username="mech2", role="Mechanic", full_name="Eli Levi"),
        "inactive": create_user(username="ghost", role="Mechanic",
                                full_name="Inactive Mech", is_active=False),
    }


class TestMechanicsListing:
    def test_manager_gets_assignable_users(self, client):
        u = seed_users()
        res = client.get("/api/mechanics", headers=auth(token_for(u["manager"])))
        assert res.status_code == 200
        roles = {row["role"] for row in res.json()}
        assert roles <= {"Mechanic", "Manager"}  # never Secretary
        ids = {row["id"] for row in res.json()}
        assert u["mech1"]["id"] in ids
        assert u["manager"]["id"] in ids  # Manager is assignable too

    def test_secretary_gets_assignable_users(self, client):
        u = seed_users()
        res = client.get("/api/mechanics", headers=auth(token_for(u["secretary"])))
        assert res.status_code == 200
        ids = {row["id"] for row in res.json()}
        assert u["mech1"]["id"] in ids and u["mech2"]["id"] in ids
        assert u["secretary"]["id"] not in ids  # secretary is NOT assignable

    def test_mechanic_forbidden(self, client):
        u = seed_users()
        res = client.get("/api/mechanics", headers=auth(token_for(u["mech1"])))
        assert res.status_code == 403

    def test_requires_auth(self, client):
        assert client.get("/api/mechanics").status_code == 401

    def test_inactive_users_excluded(self, client):
        u = seed_users()
        res = client.get("/api/mechanics", headers=auth(token_for(u["manager"])))
        ids = {row["id"] for row in res.json()}
        assert u["inactive"]["id"] not in ids

    def test_response_has_only_minimal_fields(self, client):
        u = seed_users()
        res = client.get("/api/mechanics", headers=auth(token_for(u["manager"])))
        row = res.json()[0]
        assert set(row.keys()) == {"id", "username", "full_name", "role"}
        # No sensitive fields leak.
        assert "password_hash" not in row
        assert "email" not in row


class TestAdminEndpointUnchanged:
    def test_admin_employees_still_manager_only(self, client):
        u = seed_users()
        # Secretary still forbidden on the admin endpoint.
        assert client.get("/api/admin/employees",
                          headers=auth(token_for(u["secretary"]))).status_code == 403
        # Manager still allowed.
        assert client.get("/api/admin/employees",
                          headers=auth(token_for(u["manager"]))).status_code == 200


class TestAssignmentStillWorks:
    def test_secretary_can_assign_listed_mechanic(self, client):
        """End-to-end: a Secretary lists mechanics, then opens a ticket assigning
        one of them — the previously-failing flow now works."""
        u = seed_users()
        stoken = token_for(u["secretary"])

        listed = client.get("/api/mechanics", headers=auth(stoken)).json()
        assert listed, "expected at least one assignable mechanic"
        mech_id = listed[0]["id"]

        res = client.post("/api/tickets", headers=auth(stoken), json={
            "license_plate": "55-555-55",
            "new_customer": {"full_name": "דן", "phone_number": "0501234567"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": mech_id, "description": "טיפול"})
        assert res.status_code == 201
        assert res.json()["assigned_mechanic_id"] == mech_id
