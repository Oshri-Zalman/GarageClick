# GarageClick — Deployment Guide

A 3-tier app: **React (static)** + **FastAPI** + **MySQL**. This guide gets it
online securely. Nothing here deploys automatically — follow the steps when ready.

> **Recommended "click-click" stack:** **Railway** for the database + backend
> (Railway has *managed MySQL* built-in, which matches our stack), and
> **Netlify** or **Vercel** for the static frontend. Render also works but has no
> native MySQL, so you'd attach an external MySQL (PlanetScale / Aiven).

---

## 0. Security checklist — do this BEFORE going live

- [ ] **Strong `JWT_SECRET`** (not the dev value). Generate one:
      `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- [ ] **`CORS_ORIGINS`** set to your exact frontend URL (never `*` in prod).
- [ ] **Managed MySQL** with a strong `DB_PASSWORD` (not localhost / not 123456).
- [ ] **HTTPS everywhere** (platforms provide this automatically).
- [ ] **Twilio**: real `TWILIO_*` creds as env vars; rotate the token that was
      shared in chat earlier.
- [ ] **Secrets only as platform env vars** — never commit `.env`.
- [ ] `NOTIFICATIONS_PROVIDER=twilio` only when you actually want real sends.

---

## 1. Backend (Railway)

1. New Project → **Deploy from GitHub repo** → pick this repo, root directory
   `backend`. Railway builds the included **Dockerfile**.
2. Add a **MySQL** plugin (Railway → New → Database → MySQL).
3. Set the backend **Variables** (from `backend/.env.production.example`):
   `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME` (point them at the Railway
   MySQL), `JWT_SECRET`, `JWT_EXPIRES_HOURS`, `CORS_ORIGINS`,
   `NOTIFICATIONS_PROVIDER`, `TWILIO_*`.
4. **Run migrations once** (creates tables + applies migrations + seeds the
   vehicle catalog). Either:
   - set the **start command** to
     `python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
     (simplest — idempotent, safe to run each boot), **or**
   - keep the Dockerfile start command and run `python -m app.init_db` once as a
     one-off (the included `Procfile` also declares it as a `release` step).
5. Health check path: **`/health`**.

> **Single worker:** keep one web process/worker. The logout token denylist is
> in-memory, so multiple workers wouldn't share revoked tokens. For higher scale,
> move the denylist to Redis (future).

### Render alternative
Same as above, but attach an **external MySQL** (PlanetScale/Aiven) and point the
`DB_*` vars at it. Render auto-detects the Dockerfile; set the start command and
a **Pre-Deploy Command** = `python -m app.init_db`.

---

## 2. Frontend (Netlify / Vercel)

Build settings: base directory `frontend`, build command `npm run build`, publish
directory `frontend/dist`.

**Already done on this branch:** `frontend/src/services/apiClient.ts` reads
`const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';` — Vite proxy locally,
deployed backend in production.

Just set a build-time env var on Netlify/Vercel:

```
VITE_API_URL=https://<your-backend-domain>/api
```

(If instead you serve the frontend and backend behind the **same domain** via a
reverse proxy that routes `/api` to the backend, you can leave `/api` and skip
`VITE_API_URL`.)

---

## 3. Post-deploy verification

1. `GET https://<backend>/health` → `{"status":"ok"}`
2. Open the frontend URL → log in (`manager` / `demo1234` if you ran the seed, or
   a real Manager you created).
3. Walk one full flow: open a ticket → accept → complete → archive.
4. Confirm the browser Network tab calls `https://<backend>/api/...` with no CORS
   errors.

---

## 4. What runs at deploy time

`python -m app.init_db` is **idempotent** and handles everything:
- creates any missing tables,
- applies additive migrations (`users.last_login`, `tickets_work.archived_at`,
  `parts_inventory.part_code` UNIQUE, `users.email` UNIQUE),
- seeds the vehicle make/model catalog.

Re-running it on every boot is safe.
