# GarageClick — Frontend

Garage management system frontend, built with **React 19 + TypeScript + Vite**.

## Overview

The GarageClick frontend is a Hebrew, right-to-left (RTL) single-page application
for running the day-to-day operations of a car garage. Staff sign in and — based
on their role (Manager / Secretary / Mechanic) — manage a Kanban work board, open
service tickets, track customers and vehicles, run the parts inventory, and view
operational dashboards. It talks to the [FastAPI backend](../backend/README.md)
over a REST API, authenticated with a JWT.

## Tech Stack

- **React 19** — UI library (function components + hooks)
- **TypeScript** — static typing across components, services, and shared models
- **Vite** — dev server (HMR) + production build
- **React Router** — client-side routing and role-based route guards
- **Tailwind CSS** — utility-first styling (via `@tailwindcss/vite`)
- **Axios** — HTTP client with a shared instance, JWT interceptor, and 401 handling
- **Vitest** — test runner
- **Testing Library** — component / integration testing (`@testing-library/react`, `user-event`, `jest-dom`)

## Setup

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

> **The backend must also be running.** In development, Vite proxies `/api` to the
> backend at `http://localhost:8000` (see `vite.config.ts`), so start the
> [backend](../backend/README.md) first. For production builds, point the frontend
> at a deployed API by setting `VITE_API_URL` (e.g. `https://api.example.com/api`)
> at build time; it defaults to `/api` otherwise.

## Project Structure

```
frontend/
├── index.html               # HTML entry (RTL <html dir="rtl">), mounts #root
├── vite.config.ts           # Vite + Tailwind + Vitest config, /api dev proxy
├── src/
│   ├── main.tsx             # React entry point (renders <App />)
│   ├── App.tsx              # Route table + role-guarded routes
│   ├── components/          # Reusable UI + feature components
│   ├── pages/               # Top-level route screens (one per route)
│   ├── layouts/             # App shell: AppLayout, Header, Sidebar
│   ├── services/            # Axios API clients, one module per backend resource
│   ├── hooks/               # Custom React hooks (e.g. useAuth)
│   ├── config/              # Access rules, role labels, ticket-status config
│   ├── utils/               # Pure helpers (validation, formatting, error mapping)
│   ├── types/               # Shared TypeScript models mirroring the API payloads
│   └── tests/               # Vitest + Testing Library test suites
└── public/                  # Static assets served as-is
```

The important folders under `src`:

- **components/** — Reusable and feature-specific building blocks: the Kanban board
  and cards, ticket creation flow and forms, customer/vehicle forms, parts
  inventory table and selection, dashboard cards, dialogs (confirm, change/reset
  password, ticket details), badges, and shared `LoadingSpinner` / `ErrorMessage`.
- **pages/** — One screen per route (Login, Dashboard, Kanban work board,
  Customers & Vehicles, Parts inventory, Ticket archive, Users, New Ticket, plus
  a Not-Found page).
- **layouts/** — The authenticated app shell: `AppLayout` enforces authentication
  and renders the `Header` and role-aware `Sidebar` around the routed page.
- **services/** — Centralized API layer. Each module (`auth`, `customers`,
  `vehicles`, `tickets`, `parts`, `catalog`, `mechanics`, `users`, `staff`,
  `admin`) wraps the relevant backend endpoints; all share the single `apiClient`.
- **hooks/** — Reusable stateful logic, e.g. `useAuth` for the current user/role.
- **config/** — Single sources of truth for cross-cutting rules: `access.ts`
  (which roles may reach which routes / actions), `roles.ts` (Hebrew role labels),
  and `ticketStatus.ts` (status metadata).
- **utils/** — Framework-agnostic helpers: client-side validators (phone, license
  plate, year), formatters (dates, durations), and API-error → Hebrew message
  mapping.
- **types/** — Shared TypeScript interfaces mirroring the backend payloads
  (users, customers, vehicles, tickets, parts, reports, auth token, pagination).
- **tests/** — Co-located test suites for services, components, and full-page
  integration flows.

## Main Features

- **Authentication and session handling** — Login form exchanges credentials for a
  JWT; the token and cached user are stored in `sessionStorage`, attached to every
  request, and cleared on logout or on a `401`.
- **Role-based UI (Manager / Secretary / Mechanic)** — Navigation, routes, and
  in-page actions are gated per role from a single access config.
- **Work Board (Kanban)** — Tickets grouped by status (Pending → In Progress →
  Completed) with per-column counters, driving the ticket workflow.
- **Ticket creation flow** — A guided modal/flow that supports both an existing
  vehicle (by plate) and a brand-new customer + vehicle, with mechanic assignment,
  description, and optional parts.
- **Customer & Vehicle management** — Search by plate or phone, view customer
  cards with their vehicles, and create/edit customers and vehicles.
- **Parts inventory management** — Filterable, paginated stock table with
  create/edit forms and quantity updates.
- **Compatible parts selection** — When building a ticket, only parts compatible
  with the selected vehicle are offered, with out-of-stock items flagged.
- **User management** — Manager-only screen to create users, edit name/role,
  activate/deactivate, and reset temporary passwords.
- **Dashboard** — Operational overview with status counts, average completion
  time, employee monitoring, and per-day workload summaries.
- **Ticket archive** — Read-only history of closed tickets, scoped by role
  (Mechanic sees own; Secretary sees the garage; Manager can toggle).
- **Ticket details dialog** — A read-only modal showing full ticket detail,
  including the parts used.
- **Self password change** — Any signed-in user can change their own password.

## UI / UX

- **Hebrew RTL interface** — The app renders right-to-left with Hebrew labels
  throughout.
- **Responsive, desktop-oriented layout** — Optimized for the garage's desktop
  workstations while remaining usable on smaller widths.
- **Reusable components** — Shared badges, dialogs, cards, spinners, and form
  fields are composed across pages to keep the UI consistent.
- **Loading / Error / Empty states** — Screens show a `LoadingSpinner` while
  fetching, a localized `ErrorMessage` on failure, and clear empty states.
- **Confirmation dialogs** — Destructive or irreversible actions are guarded by a
  reusable `ConfirmDialog`.
- **Validation before API calls** — Forms validate input (phone, license plate,
  year, required fields) client-side before hitting the backend.

## State & Architecture

- **Role-based routing** — `RequireRole` route guards and a `RoleHomeRedirect`
  send each role to the right landing page and block disallowed routes, all driven
  by `config/access.ts`.
- **Centralized API services** — Every backend call goes through a service module
  built on one shared Axios instance, so auth, base URL, and error handling live
  in one place.
- **Shared TypeScript models** — `src/types` mirrors the API contracts, keeping
  components and services type-safe against the backend payloads.
- **Shared reusable components** — Common UI is factored into `components/` and
  reused across pages.
- **API error localization** — Known backend error details are mapped to Hebrew
  messages (`utils/apiErrors.ts` and friends), with safe generic fallbacks so raw
  English never reaches the user.
- **State-driven ticket workflow** — The Kanban board reflects the backend state
  machine; status transitions are surfaced as board moves.
- **Client-side validation** — Pure validators in `utils/` mirror the backend
  rules to give fast feedback and reduce round-trips.

## Backend Integration

The frontend communicates with the FastAPI backend entirely over REST:

- **Axios API client** — A single `apiClient` (`services/apiClient.ts`) sets the
  base URL (`VITE_API_URL` or the `/api` dev proxy), JSON headers, and a timeout.
- **JWT authentication** — A request interceptor attaches
  `Authorization: Bearer <token>` from `sessionStorage` to every call.
- **Role-based authorization** — The UI mirrors the backend permission matrix;
  routes and actions are gated per role, and a `401` response clears the session
  and redirects to login.
- **REST API endpoints** — Resource-oriented service modules cover auth,
  customers, vehicles, tickets, parts, catalog, mechanics, users, staff, and admin.
- **Date-range filtering** — Dashboard and archive queries pass `start_date` /
  `end_date` to the backend for filtered reports and lists.
- **Parts compatibility lookup** — Ticket creation calls
  `GET /api/parts/compatible` to offer only parts that fit the selected vehicle.
- **Inventory updates** — Parts create/edit and quantity changes call the
  inventory endpoints under `/api/parts`.
- **Archive endpoints** — Closing a completed ticket and viewing history use the
  ticket archive endpoints (`archive`, `include_archived`, `archived_only`).

## Testing

- **Vitest** — Test runner, configured with the `jsdom` environment in
  `vite.config.ts`.
- **Testing Library** — `@testing-library/react` + `user-event` drive components
  the way a user would, with `jest-dom` matchers.
- **Service tests** — Verify each API service builds the right request and maps
  responses/errors correctly.
- **Component tests** — Exercise individual components (forms, dialogs, badges,
  fields) in isolation.
- **Integration tests** — Cover full-page flows such as login, the Kanban board,
  ticket creation, customers, parts inventory, and user management.

All tests currently pass (**417 tests across 36 files**).

```bash
npm test
```

## Available Scripts

```bash
npm run dev      # start the Vite dev server with HMR
npm test         # run the full Vitest suite once
npm run build    # type-check (tsc -b) and build for production
npm run lint     # run ESLint over the project
```

## Folder Tree

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── public/
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/     # reusable + feature components
    ├── pages/          # route screens
    ├── layouts/        # AppLayout, Header, Sidebar
    ├── services/       # Axios API clients (one per resource)
    ├── hooks/          # custom hooks (useAuth)
    ├── config/         # access rules, role labels, ticket status
    ├── utils/          # validators, formatters, error mapping
    ├── types/          # shared TypeScript models
    └── tests/          # Vitest + Testing Library suites
```

## Notes

- **Hebrew RTL application** — All screens are Hebrew and render right-to-left.
- **Desktop-oriented system** — Designed primarily for the garage's desktop
  workstations.
- **Reusable components throughout** — Shared UI building blocks are composed
  across the whole application for consistency.
- **Communicates with the FastAPI backend through REST APIs** — All data flows
  through the centralized Axios services, authenticated with a JWT.
