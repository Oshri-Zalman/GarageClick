"""Items 1-3: backend enforces part<->vehicle compatibility on ticket creation,
handles vehicles without a year, and supports turning a part 'general' via null."""
from .helpers import auth, create_customer, create_part, create_user, create_vehicle, token_for


def setup(client, vehicle_year=2018, make="Volkswagen", model="Golf"):
    manager = create_user(username="mgr", role="Manager")
    mech = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456",
                             manufacturer=make, model=model, year=vehicle_year)
    return token_for(manager), mech, vehicle


def open_with_part(client, token, vehicle_id, mech_id, part_id, qty=1):
    return client.post("/api/tickets", headers=auth(token), json={
        "vehicle_id": vehicle_id, "assigned_mechanic_id": mech_id,
        "description": "x", "parts": [{"part_id": part_id, "quantity": qty}]})


class TestTicketPartCompatibility:
    def test_compatible_part_accepted(self, client):
        token, mech, v = setup(client)
        part = create_part(manufacturer="Volkswagen", model="Golf", year_start=2015,
                           quantity_current=5)
        res = open_with_part(client, token, v["id"], mech["id"], part["id"])
        assert res.status_code == 201

    def test_incompatible_part_rejected_400(self, client):
        token, mech, v = setup(client)  # VW Golf
        bmw_part = create_part(part_code="BMW-1", manufacturer="BMW", model="320i",
                               year_start=2015, quantity_current=5)
        res = open_with_part(client, token, v["id"], mech["id"], bmw_part["id"])
        assert res.status_code == 400

    def test_wrong_year_rejected_400(self, client):
        token, mech, v = setup(client, vehicle_year=2018)  # VW Golf 2018
        # Part only fits 2020+.
        part = create_part(manufacturer="Volkswagen", model="Golf", year_start=2020,
                           quantity_current=5)
        res = open_with_part(client, token, v["id"], mech["id"], part["id"])
        assert res.status_code == 400

    def test_general_part_accepted_on_any_vehicle(self, client):
        token, mech, v = setup(client, make="Subaru", model="Impreza")
        general = create_part(part_code="UNI-1", manufacturer=None, model=None,
                              year_start=None, quantity_current=5)
        res = open_with_part(client, token, v["id"], mech["id"], general["id"])
        assert res.status_code == 201

    def test_vehicle_without_year_skips_year_check(self, client):
        token, mech, v = setup(client, vehicle_year=None)  # VW Golf, no year
        part = create_part(manufacturer="Volkswagen", model="Golf", year_start=2020,
                           quantity_current=5)
        res = open_with_part(client, token, v["id"], mech["id"], part["id"])
        assert res.status_code == 201  # year ignored when vehicle has no year


class TestCompatibleNoYear:
    def test_compatible_without_year_param(self, client):
        token, _, _ = setup(client)
        create_part(part_code="VW-1", manufacturer="Volkswagen", model="Golf", year_start=2020)
        res = client.get("/api/parts/compatible",
                         params={"manufacturer": "Volkswagen", "model": "Golf"},
                         headers=auth(token))
        assert res.status_code == 200
        # 2020 part is returned even though no year was given.
        assert any(p["part_code"] == "VW-1" for p in res.json())


class TestMakePartGeneral:
    def test_put_null_makes_part_general(self, client):
        token, mech, v = setup(client, make="Honda", model="Civic")
        # A VW-specific part that does NOT fit a Honda.
        part = create_part(part_code="VW-X", manufacturer="Volkswagen", model="Golf",
                           year_start=2015, quantity_current=5)
        assert open_with_part(client, token, v["id"], mech["id"], part["id"]).status_code == 400

        # Turn it general via explicit nulls.
        upd = client.put(f"/api/parts/{part['id']}", headers=auth(token),
                         json={"manufacturer": None, "model": None, "year_start": None})
        assert upd.status_code == 200
        assert upd.json()["manufacturer"] is None

        # Now it fits the Honda.
        assert open_with_part(client, token, v["id"], mech["id"], part["id"]).status_code == 201

    def test_cannot_null_required_field(self, client):
        token, _, _ = setup(client)
        part = create_part(part_code="REQ-1", quantity_current=5)
        res = client.put(f"/api/parts/{part['id']}", headers=auth(token),
                         json={"part_name": None})
        assert res.status_code == 400
