"""Tests for the Manager-only admin reporting endpoints."""
from datetime import datetime, timedelta, timezone

from .helpers import (
    auth,
    create_customer,
    create_user,
    create_ticket,
    create_vehicle,
    token_for,
)


def now_local():
    # Naive UTC — matches the DB's UTC timestamps (session pinned to +00:00).
    return datetime.now(timezone.utc).replace(tzinfo=None)


def base_ctx():
    manager = create_user(username="mgr", role="Manager")
    mech1 = create_user(username="mech1", role="Mechanic", full_name="Mech One")
    mech2 = create_user(username="mech2", role="Mechanic", full_name="Mech Two")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {
        "manager": manager,
        "mech1": mech1,
        "mech2": mech2,
        "vehicle": vehicle,
        "mtoken": token_for(manager),
    }


class TestAuthorization:
    def test_requires_manager_role(self, client):
        ctx = base_ctx()
        mech_token = token_for(ctx["mech1"])
        for path in ["/api/admin/employees", "/api/admin/tickets/summary"]:
            assert client.get(path, headers=auth(mech_token)).status_code == 403

    def test_requires_auth(self, client):
        assert client.get("/api/admin/employees").status_code == 401


class TestEmployees:
    def test_open_and_completed_today_counts(self, client):
        ctx = base_ctx()
        v, m = ctx["vehicle"]["id"], ctx["manager"]["id"]
        mech1 = ctx["mech1"]["id"]
        create_ticket(v, mech1, m, status="Pending")
        create_ticket(v, mech1, m, status="In Progress", started_at=now_local())
        create_ticket(v, mech1, m, status="Completed",
                      started_at=now_local() - timedelta(minutes=30), completed_at=now_local())

        res = client.get("/api/admin/employees", headers=auth(ctx["mtoken"]))
        assert res.status_code == 200
        by_id = {row["id"]: row for row in res.json()}
        assert by_id[mech1]["tickets_open"] == 2
        assert by_id[mech1]["tickets_completed_today"] == 1
        assert by_id[ctx["mech2"]["id"]]["tickets_open"] == 0


class TestSummary:
    def test_counts_and_avg(self, client):
        ctx = base_ctx()
        v, m, mech1 = ctx["vehicle"]["id"], ctx["manager"]["id"], ctx["mech1"]["id"]
        create_ticket(v, mech1, m, status="Pending")
        create_ticket(v, mech1, m, status="In Progress", started_at=now_local())
        create_ticket(v, mech1, m, status="Completed",
                      started_at=now_local() - timedelta(minutes=30), completed_at=now_local())

        res = client.get("/api/admin/tickets/summary", headers=auth(ctx["mtoken"]))
        assert res.status_code == 200
        body = res.json()
        assert body["total_pending"] == 1
        assert body["total_in_progress"] == 1
        assert body["total_completed"] == 1
        assert body["avg_completion_minutes"] == 30


class TestByDay:
    def test_today_row(self, client):
        ctx = base_ctx()
        v, m, mech1 = ctx["vehicle"]["id"], ctx["manager"]["id"], ctx["mech1"]["id"]
        create_ticket(v, mech1, m, status="Pending")
        create_ticket(v, mech1, m, status="Completed",
                      started_at=now_local() - timedelta(minutes=15), completed_at=now_local())

        res = client.get("/api/admin/tickets/by-day", headers=auth(ctx["mtoken"]))
        assert res.status_code == 200
        today = now_local().date().isoformat()
        row = next(r for r in res.json() if r["date"] == today)
        assert row["tickets_created"] == 2
        assert row["tickets_completed"] == 1

    def test_bad_range_400(self, client):
        ctx = base_ctx()
        res = client.get("/api/admin/tickets/by-day",
                         params={"start_date": "2026-06-10", "end_date": "2026-06-01"},
                         headers=auth(ctx["mtoken"]))
        assert res.status_code == 400


class TestPerformance:
    def test_mechanic_metrics(self, client):
        ctx = base_ctx()
        v, m, mech1 = ctx["vehicle"]["id"], ctx["manager"]["id"], ctx["mech1"]["id"]
        create_ticket(v, mech1, m, status="Completed",
                      started_at=now_local() - timedelta(minutes=20), completed_at=now_local())
        create_ticket(v, mech1, m, status="Completed",
                      started_at=now_local() - timedelta(minutes=20), completed_at=now_local())

        res = client.get("/api/admin/reports/performance",
                         params={"mechanic_id": mech1}, headers=auth(ctx["mtoken"]))
        assert res.status_code == 200
        body = res.json()
        assert body["tickets_completed"] == 2
        assert body["avg_time_per_ticket_minutes"] == 20
        assert body["total_work_hours"] == round(40 / 60, 2)

    def test_unknown_mechanic_404(self, client):
        ctx = base_ctx()
        res = client.get("/api/admin/reports/performance",
                         params={"mechanic_id": 999999}, headers=auth(ctx["mtoken"]))
        assert res.status_code == 404
