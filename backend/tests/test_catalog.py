"""Tests for the vehicle make/model catalog endpoints."""
from .helpers import auth, create_user, token_for


def any_token():
    return token_for(create_user(username="mech", role="Mechanic"))


class TestCatalog:
    def test_manufacturers_list(self, client):
        res = client.get("/api/catalog/manufacturers", headers=auth(any_token()))
        assert res.status_code == 200
        names = res.json()
        assert "Toyota" in names and "BMW" in names and "Hyundai" in names
        # MySQL sorts case-insensitively (utf8mb4_unicode_ci).
        assert names == sorted(names, key=str.lower)

    def test_models_for_manufacturer(self, client):
        res = client.get("/api/catalog/models", params={"manufacturer": "Toyota"},
                         headers=auth(any_token()))
        assert res.status_code == 200
        assert "Corolla" in res.json()
        assert "RAV4" in res.json()

    def test_models_unknown_manufacturer_empty(self, client):
        res = client.get("/api/catalog/models", params={"manufacturer": "Nope"},
                         headers=auth(any_token()))
        assert res.status_code == 200
        assert res.json() == []

    def test_all_roles_can_read(self, client):
        for role in ("Manager", "Secretary", "Mechanic"):
            t = token_for(create_user(username=f"u_{role}", role=role))
            assert client.get("/api/catalog/manufacturers", headers=auth(t)).status_code == 200

    def test_requires_auth(self, client):
        assert client.get("/api/catalog/manufacturers").status_code == 401
