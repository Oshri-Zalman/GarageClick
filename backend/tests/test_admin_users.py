"""Tests for Manager-only user management (FR-6.4)."""
from .helpers import (
    auth,
    create_customer,
    create_ticket,
    create_user,
    create_vehicle,
    token_for,
)


def manager_token():
    return token_for(create_user(username="boss", role="Manager"))


class TestCreateUser:
    def test_manager_creates_user(self, client):
        res = client.post("/api/admin/users", headers=auth(manager_token()), json={
            "username": "newmech", "password": "secret123", "role": "Mechanic",
            "full_name": "New Mechanic"})
        assert res.status_code == 201
        assert res.json()["username"] == "newmech"
        assert "password_hash" not in res.json()

    def test_created_user_can_login(self, client):
        client.post("/api/admin/users", headers=auth(manager_token()), json={
            "username": "loginme", "password": "secret123", "role": "Secretary"})
        login = client.post("/api/auth/login",
                            json={"username": "loginme", "password": "secret123"})
        assert login.status_code == 200
        assert login.json()["role"] == "Secretary"

    def test_duplicate_username_409(self, client):
        token = manager_token()
        body = {"username": "dup", "password": "secret123", "role": "Mechanic"}
        client.post("/api/admin/users", headers=auth(token), json=body)
        res = client.post("/api/admin/users", headers=auth(token), json=body)
        assert res.status_code == 409

    def test_invalid_role_422(self, client):
        res = client.post("/api/admin/users", headers=auth(manager_token()), json={
            "username": "baduser", "password": "secret123", "role": "King"})
        assert res.status_code == 422

    def test_non_manager_forbidden(self, client):
        mech = token_for(create_user(username="m", role="Mechanic"))
        res = client.post("/api/admin/users", headers=auth(mech), json={
            "username": "x", "password": "secret123", "role": "Mechanic"})
        assert res.status_code == 403


class TestUpdateUser:
    def test_change_password(self, client):
        token = manager_token()
        created = client.post("/api/admin/users", headers=auth(token), json={
            "username": "pwuser", "password": "oldpass1", "role": "Mechanic"})
        uid = created.json()["id"]

        res = client.patch(f"/api/admin/users/{uid}", headers=auth(token),
                           json={"password": "newpass1"})
        assert res.status_code == 200

        assert client.post("/api/auth/login",
                           json={"username": "pwuser", "password": "newpass1"}).status_code == 200
        assert client.post("/api/auth/login",
                           json={"username": "pwuser", "password": "oldpass1"}).status_code == 401

    def test_deactivate_blocks_login(self, client):
        token = manager_token()
        created = client.post("/api/admin/users", headers=auth(token), json={
            "username": "deact", "password": "secret123", "role": "Mechanic"})
        uid = created.json()["id"]

        client.patch(f"/api/admin/users/{uid}", headers=auth(token), json={"is_active": False})
        login = client.post("/api/auth/login",
                            json={"username": "deact", "password": "secret123"})
        assert login.status_code == 401

    def test_unknown_user_404(self, client):
        res = client.patch("/api/admin/users/999999", headers=auth(manager_token()),
                           json={"full_name": "x"})
        assert res.status_code == 404


class TestDeleteUser:
    def test_delete_user_without_history(self, client):
        token = manager_token()
        created = client.post("/api/admin/users", headers=auth(token), json={
            "username": "tossme", "password": "secret123", "role": "Mechanic"})
        uid = created.json()["id"]
        res = client.delete(f"/api/admin/users/{uid}", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["deleted"] is True

    def test_cannot_delete_self_400(self, client):
        manager = create_user(username="self", role="Manager")
        res = client.delete(f"/api/admin/users/{manager['id']}",
                            headers=auth(token_for(manager)))
        assert res.status_code == 400

    def test_delete_user_with_tickets_409(self, client):
        manager = create_user(username="mgr", role="Manager")
        mech = create_user(username="busymech", role="Mechanic")
        customer = create_customer()
        vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
        create_ticket(vehicle["id"], mech["id"], manager["id"])

        res = client.delete(f"/api/admin/users/{mech['id']}",
                            headers=auth(token_for(manager)))
        assert res.status_code == 409

    def test_unknown_user_404(self, client):
        res = client.delete("/api/admin/users/999999", headers=auth(manager_token()))
        assert res.status_code == 404
