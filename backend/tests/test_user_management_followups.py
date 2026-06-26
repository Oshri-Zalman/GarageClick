"""Items 4-6: self-lockout prevention, self password change, and email support."""
from .helpers import auth, create_user, token_for


def mgr():
    m = create_user(username="boss", role="Manager")
    return m, token_for(m)


class TestSelfLockout:
    def test_manager_cannot_deactivate_self(self, client):
        m, token = mgr()
        res = client.patch(f"/api/admin/users/{m['id']}", headers=auth(token),
                           json={"is_active": False})
        assert res.status_code == 400

    def test_manager_cannot_demote_self(self, client):
        m, token = mgr()
        res = client.patch(f"/api/admin/users/{m['id']}", headers=auth(token),
                           json={"role": "Secretary"})
        assert res.status_code == 400

    def test_manager_can_modify_other_manager(self, client):
        _, token = mgr()
        other = create_user(username="mgr2", role="Manager")
        assert client.patch(f"/api/admin/users/{other['id']}", headers=auth(token),
                            json={"is_active": False}).status_code == 200
        assert client.patch(f"/api/admin/users/{other['id']}", headers=auth(token),
                            json={"role": "Secretary"}).status_code == 200


class TestSelfPasswordChange:
    def test_change_own_password(self, client):
        create_user(username="emp", password="oldpass1", role="Mechanic")
        login = client.post("/api/auth/login",
                            json={"username": "emp", "password": "oldpass1"})
        token = login.json()["token"]

        res = client.post("/api/auth/change-password", headers=auth(token),
                          json={"current_password": "oldpass1", "new_password": "newpass1"})
        assert res.status_code == 200

        assert client.post("/api/auth/login",
                           json={"username": "emp", "password": "newpass1"}).status_code == 200
        assert client.post("/api/auth/login",
                           json={"username": "emp", "password": "oldpass1"}).status_code == 401

    def test_wrong_current_password_400(self, client):
        create_user(username="emp2", password="rightpass", role="Mechanic")
        token = client.post("/api/auth/login",
                            json={"username": "emp2", "password": "rightpass"}).json()["token"]
        res = client.post("/api/auth/change-password", headers=auth(token),
                          json={"current_password": "WRONG", "new_password": "newpass1"})
        assert res.status_code == 400

    def test_requires_auth(self, client):
        res = client.post("/api/auth/change-password",
                          json={"current_password": "a", "new_password": "bbbbbb"})
        assert res.status_code == 401


class TestUserEmail:
    def test_create_with_email(self, client):
        _, token = mgr()
        res = client.post("/api/admin/users", headers=auth(token), json={
            "username": "withmail", "password": "secret123", "role": "Mechanic",
            "email": "dave@example.com"})
        assert res.status_code == 201
        assert res.json()["email"] == "dave@example.com"

    def test_invalid_email_422(self, client):
        _, token = mgr()
        res = client.post("/api/admin/users", headers=auth(token), json={
            "username": "bademail", "password": "secret123", "role": "Mechanic",
            "email": "not-an-email"})
        assert res.status_code == 422

    def test_duplicate_email_409(self, client):
        _, token = mgr()
        body = {"password": "secret123", "role": "Mechanic", "email": "dup@example.com"}
        assert client.post("/api/admin/users", headers=auth(token),
                           json={**body, "username": "user1"}).status_code == 201
        res = client.post("/api/admin/users", headers=auth(token),
                          json={**body, "username": "user2"})
        assert res.status_code == 409

    def test_update_email(self, client):
        _, token = mgr()
        u = client.post("/api/admin/users", headers=auth(token), json={
            "username": "upd", "password": "secret123", "role": "Mechanic"}).json()
        res = client.patch(f"/api/admin/users/{u['id']}", headers=auth(token),
                           json={"email": "new@example.com"})
        assert res.status_code == 200
        assert res.json()["email"] == "new@example.com"
