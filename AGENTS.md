# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Single monolithic **ARC Cognitive Experiment** app: React SPA + Express API in one Node process (`server.ts`). Persistence is **PostgreSQL only** (not the legacy `experiment.db` SQLite file).

### Required services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | `subjects`, `sessions`, `telemetry_logs` tables (schema auto-created on app startup) |
| Node dev server | 3000 | `npm run dev` — Vite middleware + Express API |

**Optional:** Metabase (`docker compose up metabase`) on port 3001; `GEMINI_API_KEY` for Groups B/C AI in Stage 1 only.

### PostgreSQL (local, without Docker)

Docker is not required for development. If PostgreSQL is installed via apt:

```bash
sudo pg_ctlcluster 16 main start
```

Default connection (see `.env.example`): `postgres://postgres:postgres@localhost:5432/arc_experiment`

Copy `.env.example` to `.env` before first run. `GEMINI_API_KEY` can be empty for Group A flows.

### Common commands

See `package.json` scripts and `README.md` for full detail:

- **Dev server:** `npm run dev` → http://localhost:3000
- **Lint:** `npm run lint` (`tsc --noEmit`)
- **Production build:** `npm run build` (outputs `dist/`)
- **Start production:** `npm start` (after `npm run build`)

There is no automated test suite in this repo.

### Gotchas

- The app fails to persist experiment data if PostgreSQL is not reachable; the UI may still load from static `public/arc_pool_*.json`.
- `npm run build:pools` requires ARC-AGI source data outside the repo; pre-built pools in `public/` are sufficient for normal dev.
- Dev uses one process (`tsx server.ts`); do not run a separate Vite dev server.
- For API smoke tests: `POST /api/subjects`, then `GET /api/results`.
