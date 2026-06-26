# GarageClick — Backend

Garage management system backend, built with **FastAPI + SQLAlchemy (MySQL)**.

## Stack
- **FastAPI** — HTTP framework + automatic OpenAPI docs (`/docs`)
- **SQLAlchemy 2.0 (ORM)** — models + queries against MySQL
- **PyMySQL** — MySQL driver
- **Pydantic v2** — request validation
- **bcrypt** — password hashing
- **PyJWT** — JWT auth tokens (carry user id + role)
- **pytest + httpx TestClient** — integration testing

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate         # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env          # then set DB_PASSWORD
python -m app.init_db           # create database + tables from the ORM models
uvicorn app.main:app --reload   # run -> http://127.0.0.1:8000  (docs at /docs)
```

> **Schema note:** `python -m app.init_db` creates missing tables, applies
> small additive column migrations (e.g. `users.last_login`, `tickets_work.archived_at`,
> `parts_inventory.part_code` UNIQUE), and seeds the vehicle make/model catalog
> (`vehicle_models`). Re-run it after pulling changes that add columns.

### Ticket lifecycle & archiving
After a ticket reaches **Completed**, `POST /api/tickets/{id}/archive` closes it:
`archived_at` is stamped, the ticket stays in the DB and in vehicle/customer
history, but it is removed from the active board (`GET /api/tickets` excludes
archived rows unless `include_archived=true`).

### Demo data
`python -m app.seed` populates the DB with demo users (manager / secretary /
mechanic, password `demo1234`), a customer + vehicle, parts, and a sample
ticket. Idempotent — safe to re-run.

### Pagination
List endpoints (`GET /api/tickets`, `/api/customers`, `/api/vehicles`,
`/api/parts/inventory`) accept `?page=` (default 1) and `?limit=` (default 50,
max 200) and return an envelope: `{ "items": [...], "page", "limit", "total" }`.
(Search and history endpoints return plain arrays.)

## Testing

Tests run against an **isolated** database (`garageclick_test`), created
automatically and wiped between tests. A running MySQL instance is required.

```bash
pytest
```

## Project structure
```
backend/
├── app/
│   ├── main.py                # FastAPI app factory + entrypoint
│   ├── config.py              # settings from .env
│   ├── database.py            # engine, SessionLocal, Base, get_db
│   ├── models.py              # ORM models (7 tables)
│   ├── schemas.py             # Pydantic request schemas
│   ├── security.py            # bcrypt + JWT helpers
│   ├── deps.py                # get_current_user + require_roles
│   ├── init_db.py             # python -m app.init_db
│   ├── services/workflow.py   # state machine
│   └── routers/               # auth, customers, vehicles, tickets, parts
├── tests/                     # pytest integration + unit tests
├── requirements.txt
└── .env.example
```

## Authentication
1. `POST /api/auth/login` with `{ username, password }` → returns a JWT.
2. Send it on protected routes: `Authorization: Bearer <token>`.

Roles: **Manager**, **Secretary**, **Mechanic**. `require_roles(...)` restricts
routes per the SRS permissions matrix.

> Request-body validation errors return **422** (FastAPI/Pydantic convention).
> Business-rule failures use explicit codes: `400` / `403` / `404` / `409`.

### Input validation (`app/validators.py` + `app/schemas.py`)
Bad input is rejected with `422` and a clear message instead of reaching the DB:
- **phone_number** — separators stripped; must be 9–15 digits (optional leading `+`). Normalized on save (`050-123-4567` → `0501234567`).
- **license_plate** — 4–10 letters/digits with optional dashes; upper-cased on save.
- **year / year_start** — must be between 1900 and next year.
- **quantity_current** ≥ 0, part **quantity** ≥ 1, ids > 0.
- **string length caps** matching the DB columns (e.g. names ≤ 255, description ≤ 1000), so oversized input is a `422` rather than a `500`.
- **new_status** must be one of the three valid statuses.
- **part_code** is UNIQUE — a duplicate on create/update returns `409`.

### Parts compatibility (NULL = wildcard)
In `GET /api/parts/compatible`, a part whose `manufacturer`, `model`, or
`year_start` is `NULL` matches **any** vehicle on that dimension — so a general
or multi-vehicle part can be modeled as a single row. `year` is optional; when
omitted (e.g. a vehicle with no known year) the year filter is dropped.

`POST /api/tickets` **enforces** compatibility server-side: a requested part that
doesn't fit the ticket's vehicle is rejected with `400`. To convert a specific
part into a general one, `PUT /api/parts/{id}` with explicit
`manufacturer/model/year_start = null` (omitted fields are left unchanged).

### Users
`email` is optional, validated, and **unique** (`409` on duplicate). A user can
change their own password via `POST /api/auth/change-password`. A Manager cannot
deactivate their own account or remove their own Manager role (`400`).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/health` | — | Health check |
| POST | `/api/auth/login` | public | Exchange credentials for a JWT (records `last_login`) |
| GET  | `/api/auth/verify-token` | any role | Validate token + echo identity |
| POST | `/api/auth/logout` | any role | Revoke the caller's token |
| POST | `/api/auth/change-password` | any role | Change own password (`current_password` + `new_password`) |
| GET  | `/api/customers/search?license_plate=` or `?phone=` | all roles | Search customer by plate, or by phone (partial, digits-only) |
| GET  | `/api/customers` | Manager, Secretary | List customers |
| GET/POST | `/api/customers`, `/api/customers/{id}` | see code | Read/create |
| PUT  | `/api/customers/{id}` | Manager, Secretary | Update |
| GET  | `/api/vehicles/search?license_plate=` | all roles | Plate search (auto-fill) |
| POST | `/api/vehicles` | all roles | Create vehicle |
| GET/PUT | `/api/vehicles`, `/api/vehicles/{id}` | see code | Read/update |
| GET  | `/api/vehicles/{id}/tickets` | Manager, Secretary | Ticket history for a vehicle |
| GET  | `/api/customers/{id}/tickets` | Manager, Secretary | Ticket history for a customer (all vehicles) |
| GET  | `/api/mechanics` | Manager, Secretary | Active assignable users (Mechanic/Manager) for the "עובד מטפל" dropdown — minimal fields only |
| GET  | `/api/catalog/manufacturers` | all roles | Canonical manufacturer list (for the make dropdown) |
| GET  | `/api/catalog/models?manufacturer=` | all roles | Models for a manufacturer (cascading dropdown) |
| POST | `/api/tickets` | all roles | Open a ticket (existing vehicle, or new customer+vehicle) |
| POST | `/api/tickets/{id}/archive` | all roles* | Close a **Completed** ticket: stays in DB/history, leaves the board |
| GET  | `/api/tickets?include_archived=true` | all roles* | Include archived tickets (default excludes them) |
| GET  | `/api/tickets?archived_only=true` | all roles* | Only archived/closed tickets (the "My Tickets" history) |
| PATCH| `/api/tickets/{id}/status` | all roles* | Status change via state machine |
| GET  | `/api/tickets`, `/api/tickets/{id}` | all roles* | List / detail (Mechanic: own only) |
| GET  | `/api/parts/compatible?manufacturer=&model=&year=` | all roles | Compatible parts (out-of-stock flagged) |
| GET  | `/api/parts/inventory?manufacturer=&model=&part_name=&part_code=` | Manager, Secretary | Stock list, server-side filtered + paginated |
| GET  | `/api/staff/tickets/summary` | Manager, Secretary | Operational ticket counts + avg time (no per-employee data) |
| POST/PUT | `/api/parts`, `/api/parts/{id}` | Manager, Secretary | Add / update part |
| GET  | `/api/parts/reports/consumption?start_date=&end_date=` | Manager, Secretary | Parts consumption: total, per-day, **per-part**, by vehicle make, by employee (FR-7.6) |
| GET  | `/api/admin/employees` | Manager | Team monitoring (open + completed-today per employee) |
| GET  | `/api/admin/tickets/summary` | Manager | Counts per status + avg completion time |
| GET  | `/api/admin/tickets/by-day?start_date=&end_date=` | Manager | Per-day created/completed + avg time |
| GET  | `/api/admin/reports/performance?mechanic_id=` | Manager | Per-mechanic performance metrics |
| GET  | `/api/admin/users` | Manager | List all users (incl. username + is_active) for user management |
| POST | `/api/admin/users` | Manager | Create a user |
| PATCH| `/api/admin/users/{id}` | Manager | Update user (password, role, name, activate/deactivate) |
| DELETE | `/api/admin/users/{id}` | Manager | Delete a user (409 if referenced — deactivate instead) |

> \*Ticket routes add finer rules: a Mechanic may only open tickets assigned to
> themselves and may only view/update their own.

## Workflow (State Machine) — `app/services/workflow.py`
```
Pending ──(accept)──▶ In Progress ──(complete)──▶ Completed
```
- `In Progress` stamps `started_at`; `Completed` stamps `completed_at` and
  **requires** `confirmation: true`. `Completed` is terminal.
- Illegal jumps return `409`.

## Notifications (`app/services/notifications.py`)
WhatsApp notification on ticket completion. When a ticket transitions to
**Completed**, the status endpoint triggers `notify_ticket_completed(...)`,
which sends the customer a "your car is ready" message. Best-effort — a
notification failure never breaks the status update.

Provider is chosen by `NOTIFICATIONS_PROVIDER`:
- **`mock`** (default): logs + records in memory, no external calls. Tests force this.
- **`twilio`**: sends a real WhatsApp via Twilio. Set `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` in `.env`.

Phone numbers are normalized to E.164 before sending (`0501234567` →
`+972501234567`). With the Twilio **sandbox**, each recipient must first opt in
by sending the sandbox `join <code>` message once.

## Ticket creation transaction
`POST /api/tickets` runs in one SQLAlchemy transaction: optional new
customer/vehicle, parts availability check (`SELECT ... FOR UPDATE`), ticket
insert, `ticket_parts_used`, `parts_inventory` deduction, and an `audit_log`
(`action='ticket_created'`) entry. Any failure rolls the whole thing back.
