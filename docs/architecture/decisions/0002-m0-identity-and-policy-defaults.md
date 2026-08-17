# ADR 0002: M0 identity, authorization, and policy defaults

- Status: accepted
- Date: 2026-08-17

## Context

M0 introduces authenticated writes, independently administered communities, membership and GM admission, community-scoped roles, and public or private schedules. These behaviors need stable defaults before their persistence and user interfaces are built. The defaults must avoid storing passwords, prevent privileges from leaking between communities, and fail closed when visibility or authority is ambiguous.

## Decisions

### Authentication

M0 supports one sign-in method: Google OpenID Connect through Better Auth using its Next.js integration and Drizzle/PostgreSQL adapter.

- The application stores Google's immutable `sub` claim as the provider subject. Email address and display name are profile attributes, not identity keys.
- Google owns credential verification, account recovery, and provider-side security controls. Nexus Codex stores no passwords.
- Authentication identity and application person remain separate records. A successful first sign-in creates one `person` and one `auth_identity` in a transaction; later sign-ins resolve by provider plus subject.
- M0 does not link multiple authentication providers to one person.
- Better Auth uses database-backed sessions. The browser receives an opaque session cookie; authoritative session state remains in PostgreSQL.
- Sessions have a rolling seven-day lifetime and refresh after one day of activity. Multiple active devices are allowed.
- Cookie session caching is disabled in M0 so sign-out, revocation, and privilege changes take effect on the next database-backed authorization check.
- Session cookies are secure, HTTP-only, and same-site. Sessions rotate after sign-in and privilege changes; sign-out revokes the current session immediately.
- Better Auth's authentication user links to exactly one application `person`. Provider accounts and sessions belong to that authentication user; community memberships, roles, sessions, and audit events reference the application person.
- Provider tokens remain server-only and are not retained unless a documented Google integration later requires them.
- Account linking is disabled in M0. Duplicate-person correction is an explicit, audited support operation and never joins records by email or display name alone.
- Every state-changing operation resolves an authenticated actor and performs authorization again in the application/data-access boundary. Route guards and hidden controls are convenience layers, not security boundaries.

Google was selected because it supplies standards-based OIDC, stable subject identifiers, and provider-managed recovery without requiring Nexus Codex to operate credential storage. Better Auth was selected because it supports Next.js 16, Google social authentication, Drizzle/PostgreSQL persistence, and revocable database sessions without introducing a hosted identity vendor. Discord account linking remains a later integration concern and must not make a mutable Discord handle an identity key.

### Fixed community roles

Roles are independent, community-scoped grants rather than one escalating enum. Ordinary membership is represented by an active membership, not a role grant.

| Capability | Visitor | Member | GM | Owner |
| --- | --- | --- | --- | --- |
| Discover public community | yes | yes | yes | yes |
| View community/schedule | public policy | member policy | member policy | yes |
| Request membership or redeem invitation | yes | n/a | n/a | n/a |
| Request GM status | no | yes | n/a | n/a |
| Create and manage a game they GM | no | only through atomic self-service promotion | yes | yes |
| Create, edit, cancel, or staff any community game | no | no | no | yes |
| Invite members and decide membership requests | no | no | no | yes |
| Decide, suspend, or revoke GM status | no | no | no | yes |
| Change community policies and profile settings | no | no | no | yes |
| Archive, restore, or transfer ownership | no | no | no | yes |

Additional constraints:

- A GM grant provides no community-wide scheduling, membership-management, policy, lifecycle, or ownership authority.
- Administrator and organizer roles are deferred. The owner performs all community-wide administration in M0.
- Only an owner can change visibility, admission policies, schedule visibility, supported programs, lifecycle, or ownership.
- At least one active owner must remain. Ownership transfer and archival require explicit confirmation and an audit event.
- Revocation affects the next authorization check and never deletes historical authorship.

### Community and schedule visibility

New communities use privacy-preserving defaults:

- community visibility: `private`
- schedule visibility: `members`
- membership approval: `manual`
- GM admission: `approved_only`
- lifecycle status: `active`

An owner must explicitly make a community public. Making a community public does not change schedule visibility; the owner must separately select a public schedule. Making a community private immediately forces effective schedule visibility to members, even if the stored public-schedule preference is retained for a later return to public visibility.

Public communities are discoverable by name and slug. Private communities are excluded from discovery, and unauthorized direct requests use the same not-found response as a nonexistent community. Public visibility never grants membership or write authority.

Location visibility remains independent of schedule visibility. Virtual join URLs, restricted physical addresses, and access instructions are excluded from discovery results, previews, analytics, and logs. A public session page returns only fields allowed for that viewer.

### Session capacity

Capacity counts player seats; staff assignments do not consume capacity.

- default capacity: 6
- normal accepted range: 1 through 6
- exceptional accepted range: 7 through 12
- hard rejection: non-integers, values below 1, or values above 12

Only an owner may save an exceptional capacity, and a nonblank reason is required. A GM cannot override the normal range. The exception records actor, reason, timestamp, and requested capacity. M0 treats this as an operational scheduling exception, not a ruling that the eventual table is legal; scenario-specific legality belongs to M2.

### Invitations

- Invitations use a cryptographically random token with at least 256 bits of entropy; only a one-way token hash is stored.
- Default expiry is 7 days. An owner may choose 1 through 30 days.
- Invitations are single-use, revocable, and scoped to exactly one community.
- An invitation may target an existing person or an email address, or be explicitly created as a claimable link. Targeted invitations may be accepted only by the intended signed-in identity.
- Possessing an invitation permits entry into the admission flow; it does not bypass the community's membership approval mode. With the default manual mode, acceptance creates a pending request.
- Invitations request ordinary membership only. GM and owner authority require separate audited workflows.
- Expired, revoked, already-used, malformed, and unknown tokens return the same public failure response.
- Raw tokens and intended email addresses do not appear in application logs, analytics, referrers, or error details. Redemption is rate-limited and idempotent.

## Consequences

- M0-02 can implement one narrow authentication path without designing password storage or provider linking.
- Database-backed session validation adds one local database read to authenticated request paths in exchange for immediate revocation semantics. Cookie caching may be reconsidered only after measurement.
- Community queries and application services must accept actor context and evaluate current grants close to the database operation.
- A newly created community is safe before its owner completes configuration.
- Public discovery, public schedules, and location disclosure remain three distinct decisions.
- The reduced matrix keeps the first release reviewable and testable. Administrator, organizer, and custom permission builders remain out of scope until delegated community operations are demonstrated as necessary.
- Capacity exceptions remain auditable without embedding the later eligibility engine in scheduling.

## Required verification in later tickets

- Test provider-subject identity resolution independently from email and display name.
- Test seven-day rolling expiration, one-day refresh, concurrent devices, current-session sign-out, and immediate revocation after privilege changes.
- Test authentication locally and in CI through an application-controlled fixture; automated tests must not call real Google sign-in.
- Test every role against both its own community and an unrelated community.
- Test private-community nonexistence behavior across profile, schedule, session, search, counts, and autocomplete.
- Test that policy changes affect future actions without silently rewriting pending requests or existing grants.
- Test invitation replay, expiry, revocation, targeting, hashing, rate limiting, and log redaction.
- Test normal, exceptional, and hard-rejected capacity values, including override authorization and audit history.

## References

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js data-security guide](https://nextjs.org/docs/app/guides/data-security)
- [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Drizzle installation](https://better-auth.com/docs/installation)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
