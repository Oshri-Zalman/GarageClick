"""Integration tests for parts routes."""
from .helpers import auth, create_part, create_user, token_for


def role_tokens():
    return (
        token_for(create_user(username="mgr", role="Manager")),
        token_for(create_user(username="mech", role="Mechanic")),
    )


class TestCompatible:
    def _seed(self):
        create_part(part_name="Golf brakes", manufacturer="Volkswagen", model="Golf",
                    year_start=2015, quantity_current=5)
        create_part(part_name="Golf 2020 sensor", manufacturer="Volkswagen", model="Golf",
                    year_start=2020, quantity_current=5)
        create_part(part_name="Golf oil filter", part_code="OIL", manufacturer="Volkswagen",
                    model="Golf", year_start=2010, quantity_current=0)
        create_part(part_name="BMW brakes", manufacturer="BMW", model="320i",
                    year_start=2015, quantity_current=5)

    def test_only_matching_make_model_year(self, client):
        self._seed()
        _, mech = role_tokens()
        res = client.get("/api/parts/compatible",
                         params={"manufacturer": "Volkswagen", "model": "Golf", "year": 2018},
                         headers=auth(mech))
        assert res.status_code == 200
        names = sorted(p["part_name"] for p in res.json())
        assert names == ["Golf brakes", "Golf oil filter"]

    def test_flags_out_of_stock(self, client):
        self._seed()
        _, mech = role_tokens()
        res = client.get("/api/parts/compatible",
                         params={"manufacturer": "Volkswagen", "model": "Golf", "year": 2018},
                         headers=auth(mech))
        by_name = {p["part_name"]: p for p in res.json()}
        assert by_name["Golf oil filter"]["available"] is False
        assert by_name["Golf brakes"]["available"] is True

    def test_missing_params_422(self, client):
        _, mech = role_tokens()
        res = client.get("/api/parts/compatible",
                         params={"manufacturer": "Volkswagen"}, headers=auth(mech))
        assert res.status_code == 422

    def test_requires_auth(self, client):
        res = client.get("/api/parts/compatible",
                         params={"manufacturer": "Volkswagen", "model": "Golf", "year": 2018})
        assert res.status_code == 401


class TestInventoryManagement:
    def test_manager_can_create(self, client):
        mgr, _ = role_tokens()
        res = client.post("/api/parts", headers=auth(mgr), json={
            "part_name": "Spark plug", "part_code": "SPK-9",
            "manufacturer": "BMW", "model": "320i", "year_start": 2018, "quantity_current": 4,
        })
        assert res.status_code == 201
        assert res.json()["id"] is not None

    def test_mechanic_cannot_view_inventory(self, client):
        _, mech = role_tokens()
        assert client.get("/api/parts/inventory", headers=auth(mech)).status_code == 403

    def test_mechanic_cannot_create(self, client):
        _, mech = role_tokens()
        res = client.post("/api/parts", headers=auth(mech),
                          json={"part_name": "x", "part_code": "y"})
        assert res.status_code == 403
