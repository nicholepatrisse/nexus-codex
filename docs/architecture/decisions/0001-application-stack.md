# ADR 0001: Begin with a modular full-stack application

- Status: accepted
- Date: 2026-08-17

## Context

The Dawnsight Society domain model and MVP roadmap describe a transaction-heavy product spanning communities, games, signups, participation, Chronicles, and append-only progression records. The application must enforce community-scoped authorization on the server, preserve audit history and provenance, keep private location and participant data out of public queries, and make state transitions atomic and idempotent.

The roadmap targets one useful vertical slice at a time. M4 is the first complete Society-record MVP. There is no current requirement for independently deployed services, separate release cadences, or multiple client applications.

## Decision

Build one Next.js App Router application in strict TypeScript. Use PostgreSQL as the system of record and Drizzle for typed access plus reviewed SQL migrations. Keep presentation, application/domain logic, persistence, and external integrations separated inside the codebase.

Use pnpm for deterministic dependency management, Zod at runtime boundaries, Vitest for domain tests, Playwright for critical browser flows, and GitHub Actions for continuous integration. Develop against PostgreSQL 17 locally and in CI.

Authentication remains behind an application boundary until the M0 identity-provider decision is made. Domain tables begin with M0 rather than encoding an incomplete model in the stack bootstrap.

## Consequences

- Transactions and relational constraints can protect signup capacity, ownership, credit application, and ledger invariants.
- One deployment keeps the first releases operationally simple.
- Server Components and route handlers can share application services without exposing database credentials to the browser.
- Modules may be extracted later if a demonstrated scaling or ownership boundary appears.
- Authorization must still be explicit in application services and repository queries; framework routing is not an authorization boundary.
- Background integration work will use an outbox and idempotent workers when that milestone arrives.

## Guardrails

- No direct database access from React components.
- No floating-point storage for progression, currency, or fractional advancement.
- Every write requires authenticated actor context once authentication is introduced.
- Private-community visibility is enforced in queries, not only in UI code.
- Repository fixtures remain synthetic and contain no historical player identifiers or private links.
