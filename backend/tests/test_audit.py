"""Tests for the audit_log trail (ticket_created + status_changed)."""
from app.database import SessionLocal
from app.models import AuditLog

from .helpers import (
    auth,
    create_customer,
    create_user,
    create_vehicle,
    token_for,
)


def _audit_rows(action=None, resource_id=None):
    with SessionLocal() as db:
        q = db.query(AuditLog)
        if action:
            q = q.filter(AuditLog.action == action)
        if resource_id is not None:
            q = q.filter(AuditLog.resource_id == resource_id)
        return q.all()


def _open_ticket(client):
    manager = create_user(username="mgr", role="Manager")
    mechanic = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    token = token_for(manager)
    res = client.post("/api/tickets", headers=auth(token), json={
        "vehicle_id": vehicle["id"], "assigned_mechanic_id": mechanic["id"],
        "description": "בלמים"})
    return token, manager, res.json()["id"]


class TestStatusChangedAudit:
    def test_transition_writes_status_changed_row(self, client):
        token, manager, tid = _open_ticket(client)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                     json={"new_status": "In Progress"})

        rows = _audit_rows(action="status_changed", resource_id=tid)
        assert len(rows) == 1
        assert rows[0].old_value == "Pending"
        assert rows[0].new_value == "In Progress"
        assert rows[0].user_id == manager["id"]
        assert rows[0].resource_type == "ticket"

    def test_full_lifecycle_has_two_status_changes(self, client):
        token, _, tid = _open_ticket(client)
        client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                     json={"new_status": "In Progress"})
        client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                     json={"new_status": "Completed", "confirmation": True})

        rows = _audit_rows(action="status_changed", resource_id=tid)
        transitions = {(r.old_value, r.new_value) for r in rows}
        assert transitions == {("Pending", "In Progress"), ("In Progress", "Completed")}

    def test_ticket_created_audit_still_present(self, client):
        _, _, tid = _open_ticket(client)
        assert len(_audit_rows(action="ticket_created", resource_id=tid)) == 1
