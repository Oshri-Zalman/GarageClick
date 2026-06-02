# GarageClick — Backend

Node.js / Express + MySQL backend for the GarageClick garage management system.

## Stack
- **Express** — HTTP server + routing
- **mysql2** — MySQL driver with connection pooling and parameterized queries
- **dotenv** — environment configuration
- **cors** — cross-origin support for the frontend

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit DB credentials
npm run db:init           # creates the database + core tables
npm run dev               # start with auto-reload (or: npm start)
```

Server runs on `http://localhost:3000` by default. Check `GET /health`.

## Project structure
```
backend/
├── src/
│   ├── server.js                 # entrypoint (DB check + listen)
│   ├── app.js                    # Express app + middleware
│   ├── config/db.js              # MySQL connection pool
│   ├── db/
│   │   ├── schema.sql            # core tables (users, customers, vehicles)
│   │   └── init.js               # runs schema.sql
│   ├── controllers/              # request handlers
│   └── routes/                   # route definitions
└── .env.example
```

## Endpoints (Step 1)

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/health` | Service health check |
| GET  | `/api/customers` | List customers |
| GET  | `/api/customers/search?license_plate=` | Search customer by vehicle plate |
| GET  | `/api/customers/:id` | Customer + vehicles |
| POST | `/api/customers` | Create customer |
| PUT  | `/api/customers/:id` | Update customer |
| GET  | `/api/vehicles` | List vehicles |
| GET  | `/api/vehicles/search?license_plate=` | Plate search (auto-fill) |
| GET  | `/api/vehicles/:id` | Vehicle + owner |
| POST | `/api/vehicles` | Create vehicle |
| PUT  | `/api/vehicles/:id` | Update vehicle |
