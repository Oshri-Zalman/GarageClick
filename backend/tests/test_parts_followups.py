"""Tests for Stage 7 follow-ups: inventory filters, null-wildcard compatibility,
and unique part_code."""
from .helpers import auth, create_part, create_user, token_for


def staff_token():
    return token_for(create_user(username="mgr", role="Manager"))


class TestInventoryFilters:
    def _seed(self):
        create_part(part_name="Golf brakes", part_code="VW-B1", manufacturer="Volkswagen", model="Golf")
        create_part(part_name="Golf oil", part_code="VW-O1", manufacturer="Volkswagen", model="Golf")
        create_part(part_name="BMW brakes", part_code="BMW-B1", manufacturer="BMW", model="320i")

    def test_filter_by_manufacturer(self, client):
        self._seed()
        res = client.get("/api/parts/inventory", params={"manufacturer": "BMW"},
                         headers=auth(staff_token()))
        assert res.json()["total"] == 1
        assert res.json()["items"][0]["manufacturer"] == "BMW"

    def test_filter_by_part_name_partial(self, client):
        self._seed()
        res = client.get("/api/parts/inventory", params={"part_name": "brakes"},
                         headers=auth(staff_token()))
        assert res.json()["total"] == 2

    def test_filter_by_part_code_partial(self, client):
        self._seed()
        res = client.get("/api/parts/inventory", params={"part_code": "VW-"},
                         headers=auth(staff_token()))
        assert res.json()["total"] == 2


class TestNullWildcardCompatibility:
    def test_null_fields_match_any_vehicle(self, client):
        token = staff_token()
        # A general part: fits any manufacturer/model/year.
        create_part(part_name="Universal wiper", part_code="UNI-1",
                    manufacturer=None, model=None, year_start=None, quantity_current=4)
        # A specific BMW part.
        create_part(part_name="BMW brakes", part_code="BMW-B1",
                    manufacturer="BMW", model="320i", year_start=2015)

        res = client.get("/api/parts/compatible",
                         params={"manufacturer": "Volkswagen", "model": "Golf", "year": 2018},
                         headers=auth(token))
        names = {p["part_name"] for p in res.json()}
        assert "Universal wiper" in names      # wildcard matched VW Golf
        assert "BMW brakes" not in names       # specific BMW part did not


class TestUniquePartCode:
    def test_duplicate_part_code_409(self, client):
        token = staff_token()
        body = {"part_name": "A", "part_code": "DUP-1", "quantity_current": 1}
        assert client.post("/api/parts", headers=auth(token), json=body).status_code == 201
        res = client.post("/api/parts", headers=auth(token),
                          json={"part_name": "B", "part_code": "DUP-1", "quantity_current": 1})
        assert res.status_code == 409

    def test_update_to_existing_code_409(self, client):
        token = staff_token()
        client.post("/api/parts", headers=auth(token),
                    json={"part_name": "A", "part_code": "CODE-A", "quantity_current": 1})
        b = client.post("/api/parts", headers=auth(token),
                        json={"part_name": "B", "part_code": "CODE-B", "quantity_current": 1}).json()
        res = client.put(f"/api/parts/{b['id']}", headers=auth(token),
                         json={"part_code": "CODE-A"})
        assert res.status_code == 409
