# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lead Manager is a multi-source contact intelligence platform. It aggregates data from CRM providers (HubSpot, Pipedrive), support platforms (Zendesk), and other sources into unified golden records with AI-powered interaction capabilities.

**Architecture:** Separated frontend + backend + PostgreSQL, orchestrated via Docker Compose.

**Key technologies:**
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Express, TypeScript, Drizzle ORM, PostgreSQL
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Validation:** Zod

## Project Structure

```
/
├── frontend/          # Next.js application
│   └── src/app/       # App Router pages and components
├── backend/           # Express API server
│   └── src/
│       ├── config/    # Environment validation
│       ├── db/        # Drizzle schema and connection
│       ├── middleware/ # Auth, validation, error handling
│       ├── modules/   # Feature modules (auth, etc.)
│       └── types/     # Shared TypeScript types
├── docker-compose.yml
├── docs/              # Architecture documentation
└── justfile           # Task runner commands
```

## Development Commands

```bash
# Start all services (PostgreSQL + backend + frontend)
just up

# Stop services
just down

# View logs
just logs

# Stop and remove volumes
just clean

# Generate Drizzle migrations
just generate

# Apply migrations
just migrate
```

## Environment Variables

**Backend** (`backend/.env` — see `backend/.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for signing JWTs (min 16 chars)
- `PORT` — Server port (default 4000)
- `NODE_ENV` — development | production | test
- `CORS_ORIGIN` — Allowed frontend origin

**Frontend** (set via Docker Compose or `.env.local`):
- `NEXT_PUBLIC_API_URL` — Backend URL (default http://localhost:4000)

## Architecture

### Services

- **db**: PostgreSQL 16 on port 5432
- **backend**: Express API on port 4000 — handles auth, migrations, business logic
- **frontend**: Next.js on port 3000 — UI with client-side auth

### Database Schema (Drizzle)

Defined in `backend/src/db/schema.ts`:
- `users` — Authentication accounts
- `connections` — OAuth connections to external providers (per user)
- `golden_records` — Unified contact identities
- `source_contacts` — Raw contact data from each provider (JSONB)
- `source_interactions` — Interaction data (emails, calls, tickets)
- `identity_map` — Links golden records to provider-specific IDs

### Auth Flow

- `POST /auth/register` — Create account, returns JWT
- `POST /auth/login` — Authenticate, returns JWT
- JWT stored in localStorage, sent as `Authorization: Bearer` header
- `requireAuth` middleware verifies JWT on protected routes

### Frontend Auth

- `AuthContext` provides `user`, `token`, `login()`, `register()`, `logout()`
- `apiFetch()` utility auto-attaches JWT to API requests
- Unauthenticated users redirected to `/login`

## Import Aliases

- Frontend: `@/*` maps to `./src/*` (configured in `frontend/tsconfig.json`)

## Detailed Architecture

See `docs/v2_plan.md` for the full multi-source integration architecture, database schema design, and implementation phases.
