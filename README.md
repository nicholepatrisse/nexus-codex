# Nexus Codex

A community-first tracker for organized Society play: schedule games, manage signups and characters, record participation and credit, and maintain auditable Society records.

## Stack

- Next.js App Router and strict TypeScript
- PostgreSQL with Drizzle ORM and version-controlled SQL migrations
- Tailwind CSS
- Zod environment validation
- Vitest for unit tests and Playwright for browser smoke tests
- GitHub Actions for continuous integration

The application starts as one deployable service. Code is separated into presentation (`src/app`), application/domain code (`src/lib`), and persistence (`src/db`) so those boundaries can evolve without introducing a premature monorepo or distributed system.

## Requirements

- Node.js 24 (see `.node-version`)
- pnpm 11
- Docker with Compose, or another PostgreSQL 17 instance

## Local setup

```sh
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. The database-aware health endpoint is available at <http://localhost:3000/health>.

## Quality checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Database schema changes use this workflow:

```sh
pnpm db:generate
pnpm db:check
pnpm db:migrate
```

Generated SQL migrations under `drizzle/` must be reviewed and committed.
Use `pnpm db:deploy` when applying committed migrations to a deployed environment.
For production, use `pnpm db:deploy:production` and paste the production PostgreSQL URL at the
hidden prompt. The URL is passed only to the migration process; it is not written to disk or shell
history.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only PostgreSQL connection string |

Never expose `DATABASE_URL` through a `NEXT_PUBLIC_` variable or commit real credentials.

## Product boundary

The target product spine from the Dawnsight requirements is:

> community → scheduled game → signup → nominated character → eligibility → participation → Chronicle/credit → updated Society record

Authentication, the Society domain schema, integrations, and PDF generation are intentionally deferred from this foundational change. Their architecture must preserve community-scoped authorization, immutable audit history, idempotent state changes, provenance, and privacy-safe development fixtures.

Architecture decisions:

- [ADR 0001: Application stack](docs/architecture/decisions/0001-application-stack.md)
- [ADR 0002: M0 identity, authorization, and policy defaults](docs/architecture/decisions/0002-m0-identity-and-policy-defaults.md)
- [ADR 0003: M0 reusable community sharing links](docs/architecture/decisions/0003-m0-reusable-community-sharing-links.md)
