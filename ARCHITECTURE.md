# Lead Manager — Architecture Guide

## What It Is

A multi-source contact intelligence platform. Users connect their CRM and support tools (HubSpot, Pipedrive, Zendesk), and the system merges contacts from all sources into unified **golden records**. An AI agent powered by Claude provides a conversational interface over the aggregated customer data.

```
┌─────────────┐      ┌──────────────────┐      ┌────────────┐
│   Next.js   │─────▶│   Express API    │─────▶│ PostgreSQL │
│  (port 3000)│      │   (port 4000)    │      │ (port 5432)│
└─────────────┘      │                  │      └────────────┘
                     │  Auth · OAuth    │           │
                     │  Sync · AI Agent │      ┌────────────┐
                     │  Connections     │─────▶│  pg-boss   │
                     └──────────────────┘      │  (jobs)    │
                       │      │      │         └────────────┘
                ┌──────┘      │      └───────┐
                ▼             ▼              ▼
          ┌──────────┐ ┌───────────┐ ┌─────────┐
          │ HubSpot  │ │ Pipedrive │ │ Zendesk │
          └──────────┘ └───────────┘ └─────────┘
```

All services run as Docker containers on the same network via Docker Compose. No shared code between frontend and backend — they are fully independent projects.

---

## Tech Stack

| Layer          | Technology                                |
|----------------|-------------------------------------------|
| Frontend       | Next.js 15 (App Router), React 19, Tailwind CSS v4 |
| Backend        | Express, TypeScript, Node.js 20           |
| ORM            | Drizzle ORM with `node-postgres` driver   |
| Database       | PostgreSQL 16                             |
| Job Queue      | pg-boss (PostgreSQL-backed)               |
| Auth           | JWT (jsonwebtoken), bcryptjs              |
| Validation     | Zod                                       |
| AI             | Vercel AI SDK, Claude Sonnet 4.5 via AI gateway |
| Integrations   | HubSpot, Pipedrive, Zendesk              |
| Infrastructure | Docker Compose                            |

---

## Project Structure

```
lead_manager/
├── frontend/                    # Next.js application
│   └── src/app/
│       ├── components/          # ChatCard (AI assistant UI)
│       ├── connections/         # Provider connection management page
│       ├── contacts/[id]/       # Contact detail page with AI chat
│       ├── context/             # AuthContext (JWT + user state)
│       ├── lib/                 # apiFetch() utility
│       ├── login/               # Login page
│       ├── register/            # Registration page
│       └── page.tsx             # Home — golden records table
├── backend/
│   └── src/
│       ├── config/              # Zod-validated environment variables
│       ├── db/                  # Drizzle schema + connection pool
│       ├── jobs/                # pg-boss job definitions and handlers
│       ├── lib/                 # Encryption utilities (AES-256-GCM)
│       ├── middleware/          # Auth, validation, error handling
│       ├── modules/
│       │   ├── auth/            # Register, login, JWT issuance
│       │   ├── chat/            # AI agent with tool-calling
│       │   ├── connections/     # OAuth flows, connection CRUD, sync triggers
│       │   ├── contacts/        # Golden record queries
│       │   └── sync/            # Data sync logic + identity resolution
│       ├── providers/
│       │   ├── hubspot/         # HubSpot OAuth + contact/deal fetching
│       │   ├── pipedrive/       # Pipedrive OAuth + contact/deal fetching
│       │   ├── zendesk/         # Zendesk API token + user/ticket fetching
│       │   ├── registry.ts      # In-memory provider lookup
│       │   └── types.ts         # ISourceProvider interface
│       └── types/               # Shared TypeScript declarations
├── docker-compose.yml
├── justfile                     # Task runner (just up, just migrate, etc.)
├── docs/                        # v2 plan document
└── scripts/                     # Seeding utilities
```

---

## Data Model

The database implements a **golden record pattern** where contacts from multiple external sources are merged into unified identities while preserving all original source data.

```
users
  │
  ├──→ connections (one per provider per user)
  │       │
  │       ├──→ source_contacts (raw contact data, JSONB)
  │       │
  │       └──→ source_interactions (deals, tickets, notes)
  │
  └──→ golden_records (unified identity)
          │
          └──→ identity_map (links golden record ↔ provider IDs)
```

### Tables

**users** — Authentication accounts. Hashed passwords (bcrypt, 12 rounds), email as unique identifier.

**connections** — One row per user per provider. Stores AES-256-GCM encrypted OAuth tokens, token expiry, and connection status. Composite unique constraint on `(user_id, provider)`.

**golden_records** — The unified contact. Holds only core identity fields (email, first name, last name, phone). Updated via **last-write-wins** — whichever source has the most recent `source_updated_at` timestamp determines the golden record's values.

**source_contacts** — One row per contact per connection. Composite PK `(connection_id, provider_id)`. Stores both queryable extracted fields (email, phone, company, job title) and the complete raw API response as JSONB. Nothing is lost during normalization.

**source_interactions** — Deals (HubSpot, Pipedrive) and tickets (Zendesk). Composite PK `(connection_id, interaction_id)`. `entity_type` distinguishes between "deal", "ticket", etc. `content_text` holds the main body for AI consumption.

**identity_map** — Junction table linking golden records to provider-specific IDs. Composite PK `(golden_record_id, provider, provider_id)`. Fully decoupled from source data — merge/split operations only touch this table, never source records.

### Identity Resolution

When a source contact arrives during sync:

1. Check if the `(provider, provider_id)` already exists in `identity_map` → attach to existing golden record
2. Match by normalized email across the user's existing golden records → attach to match
3. No match → create a new golden record

This runs in `sync.service.ts` via `matchOrCreateGoldenRecord()`.

---

## Authentication

### Backend

- **Register** (`POST /auth/register`) — validates with Zod, hashes password, inserts user, returns signed JWT (24h expiry, payload: `{sub: userId, email}`)
- **Login** (`POST /auth/login`) — verifies credentials, returns JWT
- **Middleware** (`requireAuth`) — extracts `Bearer` token from `Authorization` header, verifies signature, attaches `req.user` to request context. Returns 401 on failure.

### Frontend

- `AuthContext` wraps the app in `layout.tsx`, provides `{user, token, isAuthenticated, login, register, logout}`
- JWT and user object stored in `localStorage`, loaded on mount
- `apiFetch()` utility auto-attaches `Authorization: Bearer <token>` to every request
- Unauthenticated users are redirected to `/login`

---

## Provider System

Every integration implements the `ISourceProvider` interface:

```typescript
interface ISourceProvider {
  id: string;
  displayName: string;

  // OAuth lifecycle
  getAuthUrl(userId: string): string;
  handleCallback(code: string): Promise<OAuthTokens>;
  refreshTokens(connection): Promise<OAuthTokens>;
  revokeTokens(connection): Promise<void>;

  // Data retrieval + normalization
  fetchContacts(connection): Promise<RawContact[]>;
  normalizeContact(raw: RawContact): SourceContact;
  fetchInteractions(connection): Promise<RawInteraction[]>;
  normalizeInteraction(raw: RawInteraction): SourceInteraction;

  // Actions (planned)
  createContact(connection, input): Promise<RawContact>;
  updateContact(connection, providerId, input): Promise<RawContact>;
  handleWebhook(event: WebhookEvent): Promise<void>;
}
```

Adding a new integration means implementing this interface and registering it. No other code changes required.

### Implemented Providers

| Provider  | Auth Method      | Contacts Source     | Interactions Source | Pagination   |
|-----------|------------------|---------------------|---------------------|--------------|
| HubSpot   | OAuth2 + refresh | `/crm/v3/objects/contacts` | Deals via `/crm/v3/objects/deals` | Cursor-based |
| Pipedrive | OAuth2 + refresh | `/v2/persons`       | Deals via `/v2/deals` | Cursor-based |
| Zendesk   | API token (basic auth) | `/api/v2/users.json` | Tickets via `/api/v2/tickets.json` | Cursor-based |

Providers are registered in an in-memory `Map` via `registry.ts` and looked up by string ID (e.g., `"hubspot"`).

---

## Background Jobs

pg-boss provides a PostgreSQL-backed job queue — no additional infrastructure needed. It uses the same database as the application.

| Job                        | Trigger            | What It Does                                                   |
|----------------------------|--------------------|----------------------------------------------------------------|
| `connection-sync`          | Manual or hourly   | Loads connection, refreshes token if needed, syncs contacts + interactions |
| `token-refresh`            | Every 5 min (cron) | Proactively refreshes tokens expiring within 10 minutes        |
| `connection-sync-scheduler`| Hourly (cron)      | Enqueues a sync job for every active connection                |

Jobs support retries with backoff. Singleton keys prevent duplicate sync jobs for the same connection.

**Lifecycle:** pg-boss starts before the Express server in `index.ts` and shuts down gracefully on `SIGTERM`/`SIGINT`.

---

## AI Agent

### Architecture

The chat module uses the Vercel AI SDK's `ToolLoopAgent` pattern — the model calls tools in a loop until it has enough information to respond.

```
Frontend (useChat hook)
    │
    │  POST /chat (streaming)
    ▼
Express handler
    │
    │  pipeAgentUIStreamToResponse()
    ▼
ToolLoopAgent (Claude Sonnet 4.5 via AI gateway)
    │
    │  Tool call: getContactDetails(contactId)
    ▼
contacts.service → DB query → golden record + sources + interactions
```

### Current Tool Surface

| Tool               | Input          | Returns                                                  |
|--------------------|----------------|----------------------------------------------------------|
| `getContactDetails`| `contactId` (UUID) | Full golden record with all source contacts and interactions |

### Frontend Integration

- `ChatCard` component using `@ai-sdk/react` `useChat()` hook
- Streams responses in real-time from the backend
- Passes JWT via `Authorization` header and `contactId` in the request body
- Accessible from the contact detail page via a floating button

---

## API Routes

| Method | Path                              | Auth     | Purpose                        |
|--------|-----------------------------------|----------|--------------------------------|
| POST   | `/auth/register`                  | Public   | Create account                 |
| POST   | `/auth/login`                     | Public   | Authenticate                   |
| GET    | `/connections`                    | Required | List user's connections        |
| GET    | `/connections/:provider/auth`     | Required | Get OAuth URL                  |
| GET    | `/connections/:provider/callback` | Public   | Handle OAuth redirect          |
| DELETE | `/connections/:id`                | Required | Disconnect + revoke tokens     |
| POST   | `/connections/:id/sync`           | Required | Queue sync job                 |
| GET    | `/contacts`                       | Required | List golden records            |
| GET    | `/contacts/:id`                   | Required | Contact detail with sources    |
| POST   | `/chat`                           | Required | AI agent (streaming)           |
| GET    | `/health`                         | Public   | Health check                   |

---

## Frontend Pages

| Route              | Purpose                                                             |
|--------------------|---------------------------------------------------------------------|
| `/`                | Home — table of all golden records, click to view detail            |
| `/login`           | Email/password login form                                           |
| `/register`        | Registration form (first name, last name, email, password)          |
| `/connections`     | Cards for each provider — connect, sync, disconnect actions         |
| `/contacts/:id`    | Contact detail — golden record header, source contacts, interactions, AI chat |

---

## Security

- **Passwords** — bcrypt with 12 salt rounds
- **JWT** — 24-hour expiry, signed with `JWT_SECRET` (min 16 chars)
- **OAuth tokens** — encrypted at rest with AES-256-GCM (12-byte random IV, 16-byte auth tag), key from `ENCRYPTION_KEY` env var (64 hex chars = 32 bytes)
- **CORS** — restricted to configured origin
- **Token revocation** — best-effort revocation on disconnect
- **Proactive refresh** — tokens refreshed before expiry via background job

---

## Infrastructure

### Docker Compose Services

| Service    | Image               | Port | Notes                                    |
|------------|----------------------|------|------------------------------------------|
| `db`       | `postgres:16-alpine` | 5432 | Persistent volume, healthcheck via `pg_isready` |
| `backend`  | Custom Dockerfile    | 4000 | Hot-reload via volume mounts for `src/` and `drizzle/` |
| `frontend` | Custom Dockerfile    | 3000 | Hot-reload, Turbopack dev server         |

Both application containers use `node:20-alpine` base images. The backend waits for the database healthcheck before starting. The frontend depends on the backend.

### Development Commands

```bash
just up        # Start all services (build + run)
just down      # Stop services
just logs      # Tail all container logs
just clean     # Stop + remove volumes (full reset)
just migrate   # Apply Drizzle migrations
just generate  # Generate Drizzle migration files
just build     # Build backend
```

---

## Design Decisions

**Why golden records + source contacts instead of just deduplicating?** Preserving source records means no data loss. The raw JSONB column stores the complete API response, so provider-specific fields that don't map to common columns are still available. The identity map is a separate table so merge/split operations are cheap — only the mapping changes, never the source data.

**Why pg-boss instead of Redis/BullMQ?** One fewer infrastructure dependency. pg-boss uses the existing PostgreSQL database for job storage, which simplifies deployment and keeps the operational surface small for a project of this scale.

**Why encrypt OAuth tokens?** Tokens stored in plaintext in the database would be a single breach away from full access to users' CRM data. AES-256-GCM with per-record random IVs ensures tokens are protected at rest.

**Why last-write-wins for golden record updates?** It's the simplest conflict resolution that produces reasonable results. When contacts are updated across multiple CRMs, the most recently modified version is likely the most accurate. The `source_updated_at` timestamp comes from the provider, not from sync time, so the strategy holds even when syncs arrive out of order.

**Why a streaming AI agent instead of simple RAG?** The tool-calling pattern lets the model decide what data it needs. Rather than stuffing all contact data into a prompt, the agent calls `getContactDetails` only when relevant, keeping context focused. The architecture supports adding more tools (search, actions) without changing the streaming transport.

---

## What's Not Implemented Yet

- **Webhooks** — real-time event ingestion from providers (endpoints defined in plan, not built)
- **Additional AI tools** — `searchContacts`, `sendEmail`, `scheduleMeeting`, `updateContact`
- **Observability** — Sentry error tracking, Langfuse LLM tracing (planned, not integrated)
- **Rate limit handling** — per-provider 429 respect and request queuing
- **Provider actions** — `createContact`, `updateContact` on the provider interface
