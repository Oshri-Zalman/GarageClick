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

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/health` | — | Health check |
| POST | `/api/auth/login` | public | Exchange credentials for a JWT |
| GET  | `/api/auth/verify-token` | any role | Validate token + echo identity |
| GET  | `/api/customers/search?license_plate=` | all roles | Search customer by plate |
| GET  | `/api/customers` | Manager, Secretary | List customers |
| GET/POST | `/api/customers`, `/api/customers/{id}` | see code | Read/create |
| PUT  | `/api/customers/{id}` | Manager, Secretary | Update |
| GET  | `/api/vehicles/search?license_plate=` | all roles | Plate search (auto-fill) |
| POST | `/api/vehicles` | all roles | Create vehicle |
| GET/PUT | `/api/vehicles`, `/api/vehicles/{id}` | see code | Read/update |
| POST | `/api/tickets` | all roles | Open a ticket (existing vehicle, or new customer+vehicle) |
| PATCH| `/api/tickets/{id}/status` | all roles* | Status change via state machine |
| GET  | `/api/tickets`, `/api/tickets/{id}` | all roles* | List / detail (Mechanic: own only) |
| GET  | `/api/parts/compatible?manufacturer=&model=&year=` | all roles | Compatible parts (out-of-stock flagged) |
| GET  | `/api/parts/inventory` | Manager, Secretary | Full stock list |
| POST/PUT | `/api/parts`, `/api/parts/{id}` | Manager, Secretary | Add / update part |

> \*Ticket routes add finer rules: a Mechanic may only open tickets assigned to
> themselves and may only view/update their own.

## Workflow (State Machine) — `app/services/workflow.py`
```
Pending ──(accept)──▶ In Progress ──(complete)──▶ Completed
```
- `In Progress` stamps `started_at`; `Completed` stamps `completed_at` and
  **requires** `confirmation: true`. `Completed` is terminal.
- Illegal jumps return `409`.

## Ticket creation transaction
`POST /api/tickets` runs in one SQLAlchemy transaction: optional new
customer/vehicle, parts availability check (`SELECT ... FOR UPDATE`), ticket
insert, `ticket_parts_used`, `parts_inventory` deduction, and an `audit_log`
(`action='ticket_created'`) entry. Any failure rolls the whole thing back.
