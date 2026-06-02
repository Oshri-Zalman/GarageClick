# GarageClick — Backend

Node.js / Express + MySQL backend for the GarageClick garage management system.

## Stack
- **Express** — HTTP server + routing
- **mysql2** — MySQL driver with connection pooling and parameterized queries
- **jsonwebtoken** — JWT auth tokens (carry user id + role)
- **bcryptjs** — password hashing
- **dotenv** — environment configuration
- **cors** — cross-origin support for the frontend
- **Jest + Supertest** — integration testing

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit DB credentials
npm run db:init           # creates the database + core tables
npm run dev               # start with auto-reload (or: npm start)
```

Server runs on `http://localhost:3000` by default. Check `GET /health`.

## Testing

Integration tests run against an **isolated** database (`garageclick_test`),
which is created automatically and truncated between tests. A running MySQL
instance is required.

```bash
npm test
```

## Project structure
```
backend/
├── src/
│   ├── server.js                 # entrypoint (DB check + listen)
│   ├── app.js                    # Express app + middleware + route mounting
│   ├── config/db.js              # MySQL connection pool
│   ├── db/
│   │   ├── tables.sql            # table DDL (db-agnostic, idempotent)
│   │   ├── migrate.js            # ensureSchema(dbName)
│   │   └── init.js               # npm run db:init
│   ├── middleware/auth.js        # authenticate + authorize(roles)
│   ├── utils/                    # jwt + password helpers
│   ├── controllers/              # request handlers (auth, customers, vehicles)
│   └── routes/                   # route definitions
├── tests/                        # Jest + Supertest integration tests
└── .env.example
```

## Authentication

1. `POST /api/auth/login` with `{ username, password }` → returns a JWT.
2. Send it on protected routes: `Authorization: Bearer <token>`.

Roles: **Manager**, **Secretary**, **Mechanic**. `authorize([...])` restricts
routes per the SRS permissions matrix.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/health` | — | Service health check |
| POST | `/api/auth/login` | public | Exchange credentials for a JWT |
| GET  | `/api/auth/verify-token` | any role | Validate token + echo identity |
| GET  | `/api/customers` | Manager, Secretary | List customers |
| GET  | `/api/customers/search?license_plate=` | all roles | Search customer by vehicle plate |
| GET  | `/api/customers/:id` | all roles | Customer + vehicles |
| POST | `/api/customers` | all roles | Create customer |
| PUT  | `/api/customers/:id` | Manager, Secretary | Update customer |
| GET  | `/api/vehicles` | Manager, Secretary | List vehicles |
| GET  | `/api/vehicles/search?license_plate=` | all roles | Plate search (auto-fill) |
| GET  | `/api/vehicles/:id` | all roles | Vehicle + owner |
| POST | `/api/vehicles` | all roles | Create vehicle |
| PUT  | `/api/vehicles/:id` | Manager, Secretary | Update vehicle |

> "all roles" = Manager, Secretary, Mechanic (any authenticated user).
