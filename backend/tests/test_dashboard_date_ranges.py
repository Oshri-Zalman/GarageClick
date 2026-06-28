"""Item 1: optional date-range filtering on the dashboard summary endpoints."""
from datetime import datetime

from .helpers import (
    auth,
    create_customer,
    create_ticket,
    create_user,
    create_vehicle,
    token_for,
)

OLD = datetime(2020, 1, 1, 10, 0, 0)
OLD_DATE = "2020-01-01"
RECENT = datetime(2026, 6, 1, 10, 0, 0)
RANGE_START = "2026-01-01"


def ctx():
    manager = create_user(username="mgr", role="Manager")
    secretary = create_user(username="sec", role="Secretary")
    mech = create_user(username="mech", role="Mechanic")
    customer = create_customer()
    vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
    return {"manager": manager, "secretary": secretary, "mech": mech, "vehicle": vehicle}


def _seed_two_eras(c):
    v, m, mech = c["vehicle"]["id"], c["manager"]["id"], c["mech"]["id"]
    create_ticket(v, mech, m, status="Pending", created_at=OLD)       # old
    create_ticket(v, mech, m, status="Pending", created_at=RECENT)    # recent
    create_ticket(v, mech, m, status="Pending", created_at=RECENT)    # recent


class TestAdminSummaryRange:
    def test_no_range_counts_all(self, client):
        c = ctx()
        _seed_two_eras(c)
        body = client.get("/api/admin/tickets/summary",
                          headers=auth(token_for(c["manager"]))).json()
        assert body["total_pending"] == 3

    def test_range_filters_by_created_at(self, client):
        c = ctx()
        _seed_two_eras(c)
        body = client.get("/api/admin/tickets/summary",
                          params={"start_date": RANGE_START},
                          headers=auth(token_for(c["manager"]))).json()
        assert body["total_pending"] == 2  # only the recent ones

    def test_bad_range_400(self, client):
        c = ctx()
        res = client.get("/api/admin/tickets/summary",
                         params={"start_date": "2026-06-10", "end_date": "2026-06-01"},
                         headers=auth(token_for(c["manager"])))
        assert res.status_code == 400


class TestStaffSummaryRange:
    def test_range_filters(self, client):
        c = ctx()
        _seed_two_eras(c)
        body = client.get("/api/staff/tickets/summary",
                          params={"start_date": RANGE_START},
                          headers=auth(token_for(c["secretary"]))).json()
        assert body["total_pending"] == 2


class TestPerformanceRange:
    def test_range_filters_completed(self, client):
        c = ctx()
        v, m, mech = c["vehicle"]["id"], c["manager"]["id"], c["mech"]["id"]
        create_ticket(v, mech, m, status="Completed", created_at=OLD,
                      started_at=OLD, completed_at=OLD)
        create_ticket(v, mech, m, status="Completed", created_at=RECENT,
                      started_at=RECENT, completed_at=RECENT)

        all_time = client.get("/api/admin/reports/performance",
                             params={"mechanic_id": mech},
                             headers=auth(token_for(c["manager"]))).json()
        assert all_time["tickets_completed"] == 2

        ranged = client.get("/api/admin/reports/performance",
                           params={"mechanic_id": mech, "start_date": RANGE_START},
                           headers=auth(token_for(c["manager"]))).json()
        assert ranged["tickets_completed"] == 1
