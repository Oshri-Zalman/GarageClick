"""Integration tests for ticket parts deduction, audit, and transaction rollback."""
from app.models import AuditLog, TicketPartUsed, TicketWork

from .helpers import (
    auth,
    count,
    create_customer,
    create_part,
    create_user,
    create_vehicle,
    part_quantity,
    token_for,
)


def ctx_factory():
    secretary = create_user(username="sec", role="Secretary")
    mechanic = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {
        "secretary": secretary,
        "mechanic": mechanic,
        "token": token_for(secretary),
        "vehicle": vehicle,
    }


def open_with_parts(client, ctx, parts):
    return client.post("/api/tickets", headers=auth(ctx["token"]), json={
        "vehicle_id": ctx["vehicle"]["id"],
        "assigned_mechanic_id": ctx["mechanic"]["id"],
        "description": "החלפת בלמים",
        "parts": parts,
    })


class TestPartsDeductionAndAudit:
    def test_deducts_records_and_audits(self, client):
        ctx = ctx_factory()
        brakes = create_part(part_name="Brakes", quantity_current=10)
        oil = create_part(part_name="Oil", part_code="OIL-1", quantity_current=5)

        res = open_with_parts(client, ctx, [
            {"part_id": brakes["id"], "quantity": 2},
            {"part_id": oil["id"], "quantity": 1},
        ])
        assert res.status_code == 201
        tid = res.json()["id"]

        assert part_quantity(brakes["id"]) == 8
        assert part_quantity(oil["id"]) == 4
        assert count(TicketPartUsed) == 2

        from app.database import SessionLocal
        with SessionLocal() as db:
            audit = db.query(AuditLog).filter(
                AuditLog.action == "ticket_created", AuditLog.resource_id == tid
            ).all()
        assert len(audit) == 1
        assert audit[0].user_id == ctx["secretary"]["id"]
        assert audit[0].resource_type == "ticket"
        assert audit[0].new_value == res.json()["ticket_number"]

    def test_quantity_defaults_to_one(self, client):
        ctx = ctx_factory()
        part = create_part(quantity_current=3)
        res = open_with_parts(client, ctx, [{"part_id": part["id"]}])
        assert res.status_code == 201
        assert part_quantity(part["id"]) == 2

    def test_no_parts_allowed(self, client):
        ctx = ctx_factory()
        res = open_with_parts(client, ctx, [])
        assert res.status_code == 201
        assert count(AuditLog) == 1  # creation still audited

    def test_out_of_stock_rolls_back_everything(self, client):
        ctx = ctx_factory()
        ok = create_part(part_name="OK", quantity_current=5)
        low = create_part(part_name="Low", part_code="LOW-1", quantity_current=1)

        res = open_with_parts(client, ctx, [
            {"part_id": ok["id"], "quantity": 2},
            {"part_id": low["id"], "quantity": 5},  # only 1 available
        ])
        assert res.status_code == 409

        # Nothing changed.
        assert part_quantity(ok["id"]) == 5
        assert part_quantity(low["id"]) == 1
        assert count(TicketWork) == 0
        assert count(AuditLog) == 0
        assert count(TicketPartUsed) == 0

    def test_nonexistent_part_400(self, client):
        ctx = ctx_factory()
        res = open_with_parts(client, ctx, [{"part_id": 999999, "quantity": 1}])
        assert res.status_code == 400

    def test_invalid_quantity_422(self, client):
        ctx = ctx_factory()
        part = create_part(quantity_current=5)
        res = open_with_parts(client, ctx, [{"part_id": part["id"], "quantity": 0}])
        assert res.status_code == 422
