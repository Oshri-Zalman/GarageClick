"""A ticket may only be assigned to a Mechanic or a Manager — never a Secretary."""
from .helpers import auth, create_customer, create_user, create_vehicle, token_for


def setup(client):
    manager = create_user(username="mgr", role="Manager")
    secretary = create_user(username="sec", role="Secretary")
    mechanic = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return token_for(manager), manager, secretary, mechanic, vehicle


def _open(client, token, vehicle_id, assignee_id):
    return client.post("/api/tickets", headers=auth(token), json={
        "vehicle_id": vehicle_id, "assigned_mechanic_id": assignee_id, "description": "x"})


def test_assign_to_secretary_rejected_400(client):
    mtoken, _, secretary, _, vehicle = setup(client)
    res = _open(client, mtoken, vehicle["id"], secretary["id"])
    assert res.status_code == 400


def test_assign_to_mechanic_ok(client):
    mtoken, _, _, mechanic, vehicle = setup(client)
    assert _open(client, mtoken, vehicle["id"], mechanic["id"]).status_code == 201


def test_assign_to_manager_ok(client):
    mtoken, manager, _, _, vehicle = setup(client)
    assert _open(client, mtoken, vehicle["id"], manager["id"]).status_code == 201
