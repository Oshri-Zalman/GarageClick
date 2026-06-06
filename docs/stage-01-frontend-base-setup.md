# Stage 01 — Frontend Base Setup

## What was implemented

A complete React + TypeScript frontend foundation for GarageClick — a Hebrew, RTL, desktop-only garage management web application.

### Tech stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 6 | Type safety |
| Vite | 8 | Build tool & dev server |
| React Router v7 | 7 | Client-side routing |
| Tailwind CSS v4 | 4 | Utility-first styling |
| Axios | 1 | HTTP client |
| Vitest | 4 | Unit/component tests |
| Testing Library | 16 | DOM assertions |

---

## Folder structure created

```
frontend/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorMessage.tsx
│   ├── layouts/             # App shell layout
│   │   ├── AppLayout.tsx    # Wraps all authenticated pages
│   │   ├── Header.tsx       # Top bar with logo, user info, logout
│   │   └── Sidebar.tsx      # Hebrew RTL navigation sidebar
│   ├── pages/               # One file per route
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── KanbanPage.tsx
│   │   ├── NewTicketPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── PartsPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── UsersPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/            # API calls
│   │   ├── apiClient.ts     # Axios instance with JWT interceptor
│   │   └── auth.ts          # login / logout / getCurrentUser
│   ├── hooks/
│   │   └── useAuth.ts       # React hook for current user state
│   ├── types/
│   │   └── index.ts         # Shared TypeScript types (User, Ticket, Part…)
│   ├── tests/
│   │   ├── setup.ts         # jest-dom import
│   │   ├── App.test.tsx     # App renders + login form
│   │   ├── routing.test.tsx # All page routes render Hebrew headings
│   │   └── layout.test.tsx  # Sidebar/Header Hebrew labels & role gating
│   ├── App.tsx              # BrowserRouter + Routes
│   ├── main.tsx             # React root mount
│   └── index.css            # Tailwind + global RTL body direction
├── vite.config.ts           # Vite + Tailwind + Vitest config
├── tsconfig.app.json        # TS config with vitest/globals types
└── package.json             # Scripts: dev / build / test / test:watch
```

---

## Key design decisions

- **RTL by default**: `body { direction: rtl }` is set globally in `index.css`; the layout also passes `dir="rtl"` explicitly.
- **JWT via sessionStorage**: `apiClient.ts` attaches the token on every request and redirects to `/login` on 401.
- **Role-gated sidebar**: Manager-only pages (Reports, User Management) are hidden in the sidebar for Secretary/Mechanic.
- **Dev proxy**: Vite proxies `/api/*` → `http://localhost:8000` so the backend is called without CORS during development.

---

## How to run the frontend

```bash
cd frontend
npm install        # only needed once
npm run dev        # starts at http://localhost:5173
```

The backend must be running on port 8000 for API calls to work.

---

## Tests added

| File | What is tested |
|------|---------------|
| `App.test.tsx` | App renders, login page shows Hebrew form, submit button label |
| `routing.test.tsx` | All 9 route components render with correct Hebrew headings |
| `layout.test.tsx` | Sidebar shows Hebrew nav items; role gating hides/shows Manager pages; Header shows user name and Hebrew role badge |

Run tests:

```bash
cd frontend
npm test            # single run
npm run test:watch  # watch mode
```

---

## What must be verified before moving to Stage 2

- [ ] `npm run dev` starts without errors
- [ ] Navigating to `/login` shows the Hebrew login form
- [ ] Navigating to `/dashboard` after login shows the sidebar with all Hebrew nav items
- [ ] Manager role sees Reports and User Management; Mechanic/Secretary do not
- [ ] All 18 unit tests pass (`npm test`)
- [ ] `npm run build` completes without TypeScript errors
- [ ] No console errors in the browser on any route
