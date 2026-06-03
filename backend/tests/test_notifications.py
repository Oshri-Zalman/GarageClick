"""Tests for the (mock) WhatsApp notification service + the completion hook."""
from app.services import notifications

from .helpers import auth, create_customer, create_user, create_vehicle, token_for


class TestE164Normalization:
    def test_israeli_local_to_international(self):
        assert notifications.to_e164("0501234567") == "+972501234567"

    def test_strips_separators(self):
        assert notifications.to_e164("050-123-4567") == "+972501234567"

    def test_keeps_existing_plus(self):
        assert notifications.to_e164("+14155238886") == "+14155238886"

    def test_country_prefix_without_plus(self):
        assert notifications.to_e164("972501234567") == "+972501234567"


class TestNotificationServiceUnit:
    def test_send_returns_result_and_records(self):
        before = len(notifications.sent_messages())
        res = notifications.send_whatsapp("0501234567", "hi", ticket_number="TKT-00001")
        assert res["success"] is True
        assert res["message_id"].startswith("mock-")
        assert len(notifications.sent_messages()) == before + 1

    def test_notify_ticket_completed_builds_message(self):
        ticket = {"customer_phone": "0509999999", "ticket_number": "TKT-00042"}
        res = notifications.notify_ticket_completed(ticket)
        assert res["phone"] == "+972509999999"  # normalized to E.164
        assert "הסתיים" in res["message"]
        assert "TKT-00042" not in res["message"]  # ticket number removed from body
        assert res["ticket_number"] == "TKT-00042"  # still kept as metadata

    def test_reset_clears(self):
        notifications.send_whatsapp("0501234567", "x")
        notifications.reset()
        assert notifications.sent_messages() == []


class TestCompletionHook:
    def _open_ticket(self, client):
        manager = create_user(username="mgr", role="Manager")
        mechanic = create_user(username="mech", role="Mechanic")
        customer = create_customer(full_name="דן", phone_number="0501234567")
        vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
        token = token_for(manager)
        res = client.post("/api/tickets", headers=auth(token), json={
            "vehicle_id": vehicle["id"], "assigned_mechanic_id": mechanic["id"],
            "description": "בלמים"})
        return token, res.json()["id"]

    def test_completion_triggers_one_whatsapp(self, client):
        token, tid = self._open_ticket(client)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                     json={"new_status": "In Progress"})
        # No message should have been sent yet.
        assert notifications.sent_messages() == []

        client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                     json={"new_status": "Completed", "confirmation": True})

        sent = notifications.sent_messages()
        assert len(sent) == 1
        assert sent[0]["phone"] == "+972501234567"  # normalized to E.164
        assert "הסתיים" in sent[0]["message"]

    def test_in_progress_does_not_notify(self, client):
        token, tid = self._open_ticket(client)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                     json={"new_status": "In Progress"})
        assert notifications.sent_messages() == []
