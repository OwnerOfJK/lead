# Lead

A multi-source contact intelligence platform that aggregates data from CRM providers (HubSpot, Pipedrive, Zendesk) and support platforms into unified contact records with AI-powered interaction capabilities.

**Live:** https://lead.leaf-books.com/

## Features

- **Multi-Provider Integration** – OAuth connections to HubSpot, Pipedrive, and Zendesk
- **Unified Contact Records** – Merge contact and interaction data from multiple sources
- **Automated Sync** – Background synchronization of contacts and interactions with conflict resolution
- **AI Assistant** – Chat interface to ask questions about contacts using aggregated context

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Backend:** Express, TypeScript, Drizzle ORM, PostgreSQL
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Orchestration:** Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose
- `.env` file with credentials for CRM providers (see `.env.example`)

### Development

```bash
# Start all services (PostgreSQL + backend + frontend)
just up

# Stop services
just down

# Apply database migrations
just migrate

# Backend TypeScript check
cd backend && npx tsc --noEmit
```

Services:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Database:** localhost:5432

## Project Structure

```
/
├── frontend/              # Next.js application
│   └── src/app/
│       ├── (auth)/       # Login/register pages
│       ├── connections/  # OAuth connection management
│       ├── contacts/     # Contact list and details
│       ├── components/   # Reusable React components
│       └── lib/         # Utilities (API client, auth context)
├── backend/              # Express API
│   └── src/
│       ├── modules/
│       │   ├── auth/     # JWT authentication
│       │   ├── connections/  # OAuth provider integration
│       │   ├── contacts/     # Contact CRUD
│       │   ├── chat/         # AI assistant
│       │   └── sync/         # Background data synchronization
│       ├── db/           # Drizzle schema and migrations
│       ├── middleware/   # Auth, validation, error handling
│       └── types/        # Shared TypeScript types
├── docker-compose.yml    # Service orchestration
└── justfile             # Development commands
```

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – System design, data flow, and provider integrations
- **[CLAUDE.md](./CLAUDE.md)** – Development guidelines and environment setup
