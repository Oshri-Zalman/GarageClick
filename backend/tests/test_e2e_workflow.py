"""End-to-end workflow test — the full GarageClick lifecycle, driven entirely
through the public API, from a brand-new customer to a completed & released car.

Happy path (TestFullLifecycle) walks every stage; the other classes cover the
edge cases / challenges that the system must handle.
"""
from app.database import SessionLocal
from app.models import AuditLog
from app.services import notifications

from .helpers import auth, create_user, token_for


def _login(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


class TestFullLifecycle:
    def test_new_customer_to_completed_release(self, client):
        # --- 0. Bootstrap: the garage's Manager already exists ---
        manager = create_user(username="owner", password="manager123", role="Manager",
                              full_name="Owner")
        mtoken = _login(client, "owner", "manager123")

        # --- 1. Manager onboards a Secretary and a Mechanic (user management) ---
        sec = client.post("/api/admin/users", headers=auth(mtoken), json={
            "username": "sara", "password": "secret123", "role": "Secretary",
            "full_name": "Sara Secretary"})
        assert sec.status_code == 201
        mech = client.post("/api/admin/users", headers=auth(mtoken), json={
            "username": "moshe", "password": "secret123", "role": "Mechanic",
            "full_name": "Moshe Mechanic"})
        assert mech.status_code == 201
        mech_id = mech.json()["id"]

        # --- 2. The new employees can log in (created users are real) ---
        stoken = _login(client, "sara", "secret123")
        mech_token = _login(client, "moshe", "secret123")

        # --- 3. Stock a compatible part (Manager/Secretary manage inventory) ---
        part = client.post("/api/parts", headers=auth(stoken), json={
            "part_name": "Brake pads", "part_code": "BMW-BRK-1",
            "manufacturer": "BMW", "model": "320i", "year_start": 2018,
            "quantity_current": 5})
        assert part.status_code == 201
        part_id = part.json()["id"]

        # --- 4. Customer arrives. Secretary searches the plate -> NOT found ---
        search = client.get("/api/vehicles/search", params={"license_plate": "999-999"},
                            headers=auth(stoken))
        assert search.status_code == 200
        assert search.json() == {"found": False}

        # --- 5. Secretary checks which parts fit the (new) BMW 320i 2020 ---
        compat = client.get("/api/parts/compatible",
                            params={"manufacturer": "BMW", "model": "320i", "year": 2020},
                            headers=auth(stoken))
        assert compat.status_code == 200
        assert any(p["id"] == part_id and p["available"] for p in compat.json())

        # --- 6. Secretary opens the ticket: new customer + new vehicle + part,
        #         assigned to Moshe the mechanic (scenario B) ---
        opened = client.post("/api/tickets", headers=auth(stoken), json={
            "license_plate": "999-999",
            "new_customer": {"full_name": "דוד לוי", "phone_number": "0526861377"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": mech_id,
            "description": "החלפת רפידות בלמים",
            "parts": [{"part_id": part_id, "quantity": 2}]})
        assert opened.status_code == 201, opened.text
        ticket = opened.json()
        ticket_id = ticket["id"]
        assert ticket["status"] == "Pending"
        assert ticket["customer_name"] == "דוד לוי"
        assert ticket["license_plate"] == "999-999"

        # --- 7. The vehicle is now on file: next search auto-fills it ---
        again = client.get("/api/vehicles/search", params={"license_plate": "999-999"},
                           headers=auth(stoken))
        assert again.json()["customer_phone"] == "0526861377"
        assert again.json()["model"] == "320i"

        # --- 8. Inventory was deducted (5 -> 3) at ticket creation ---
        inv = client.get("/api/parts/inventory", headers=auth(stoken))
        assert next(p for p in inv.json()["items"] if p["id"] == part_id)["quantity_current"] == 3

        # --- 9. Moshe sees ONLY his board, with this one ticket ---
        board = client.get("/api/tickets", headers=auth(mech_token))
        assert [t["id"] for t in board.json()["items"]] == [ticket_id]

        # --- 10. Moshe accepts the job: Pending -> In Progress ---
        accept = client.patch(f"/api/tickets/{ticket_id}/status", headers=auth(mech_token),
                              json={"new_status": "In Progress"})
        assert accept.status_code == 200
        assert accept.json()["status"] == "In Progress"
        assert accept.json()["started_at"] is not None

        # --- 11. Moshe finishes: In Progress -> Completed (explicit confirmation) ---
        assert notifications.sent_messages() == []  # nothing sent before completion
        done = client.patch(f"/api/tickets/{ticket_id}/status", headers=auth(mech_token),
                           json={"new_status": "Completed", "confirmation": True})
        assert done.status_code == 200
        assert done.json()["status"] == "Completed"
        assert done.json()["completed_at"] is not None

        # --- 12. Customer is notified via WhatsApp exactly once ---
        sent = notifications.sent_messages()
        assert len(sent) == 1
        assert sent[0]["phone"] == "+972526861377"  # normalized to E.164
        assert "הסתיים" in sent[0]["message"]

        # --- 13. Full audit trail: created + 2 transitions ---
        with SessionLocal() as db:
            rows = db.query(AuditLog).filter(AuditLog.resource_id == ticket_id).all()
        actions = sorted(r.action for r in rows)
        assert actions == ["status_changed", "status_changed", "ticket_created"]

        # --- 14. Manager dashboards reflect the finished job ---
        summary = client.get("/api/admin/tickets/summary", headers=auth(mtoken)).json()
        assert summary["total_completed"] == 1
        assert summary["total_pending"] == 0

        employees = client.get("/api/admin/employees", headers=auth(mtoken)).json()
        moshe = next(e for e in employees if e["id"] == mech_id)
        assert moshe["tickets_completed_today"] == 1
        assert moshe["last_login"] is not None

        consumption = client.get("/api/parts/reports/consumption", headers=auth(mtoken)).json()
        assert consumption["total_parts_used"] == 2
        assert any(r["manufacturer"] == "BMW" for r in consumption["by_vehicle_manufacturer"])

        perf = client.get("/api/admin/reports/performance",
                         params={"mechanic_id": mech_id}, headers=auth(mtoken)).json()
        assert perf["tickets_completed"] == 1


class TestEdgeCases:
    def _bootstrap(self, client):
        manager = create_user(username="owner", password="manager123", role="Manager")
        mtoken = _login(client, "owner", "manager123")
        mech = create_user(username="moshe", role="Mechanic")
        other = create_user(username="dan", role="Mechanic")
        return mtoken, mech, other

    def test_out_of_stock_rolls_back_whole_ticket(self, client):
        mtoken, mech, _ = self._bootstrap(client)
        part = client.post("/api/parts", headers=auth(mtoken), json={
            "part_name": "Rare", "part_code": "R1", "manufacturer": "BMW",
            "model": "320i", "year_start": 2018, "quantity_current": 1}).json()

        res = client.post("/api/tickets", headers=auth(mtoken), json={
            "license_plate": "111-111",
            "new_customer": {"full_name": "x", "phone_number": "0500000000"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": mech["id"], "description": "y",
            "parts": [{"part_id": part["id"], "quantity": 5}]})  # only 1 in stock
        assert res.status_code == 409

        # Nothing leaked: the new customer/vehicle were rolled back.
        assert client.get("/api/vehicles/search", params={"license_plate": "111-111"},
                          headers=auth(mtoken)).json() == {"found": False}

    def test_mechanic_cannot_open_for_another(self, client):
        mtoken, mech, other = self._bootstrap(client)
        res = client.post("/api/tickets", headers=auth(token_for(mech)), json={
            "license_plate": "222-222",
            "new_customer": {"full_name": "x", "phone_number": "0500000000"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": other["id"], "description": "y"})
        assert res.status_code == 403

    def test_complete_requires_confirmation_and_legal_order(self, client):
        mtoken, mech, _ = self._bootstrap(client)
        # Open a no-parts ticket for the mechanic.
        tid = client.post("/api/tickets", headers=auth(mtoken), json={
            "license_plate": "333-333",
            "new_customer": {"full_name": "x", "phone_number": "0500000000"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": mech["id"], "description": "y"}).json()["id"]

        # Illegal skip Pending -> Completed.
        assert client.patch(f"/api/tickets/{tid}/status", headers=auth(token_for(mech)),
                            json={"new_status": "Completed", "confirmation": True}).status_code == 409

        client.patch(f"/api/tickets/{tid}/status", headers=auth(token_for(mech)),
                     json={"new_status": "In Progress"})
        # Completing without confirmation is refused.
        assert client.patch(f"/api/tickets/{tid}/status", headers=auth(token_for(mech)),
                            json={"new_status": "Completed"}).status_code == 400

    def test_other_mechanic_cannot_touch_ticket(self, client):
        mtoken, mech, other = self._bootstrap(client)
        tid = client.post("/api/tickets", headers=auth(mtoken), json={
            "license_plate": "444-444",
            "new_customer": {"full_name": "x", "phone_number": "0500000000"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": mech["id"], "description": "y"}).json()["id"]

        assert client.get(f"/api/tickets/{tid}", headers=auth(token_for(other))).status_code == 403
        assert client.patch(f"/api/tickets/{tid}/status", headers=auth(token_for(other)),
                            json={"new_status": "In Progress"}).status_code == 403
