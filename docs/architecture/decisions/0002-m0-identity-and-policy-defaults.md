# ADR 0002: M0 identity, authorization, and policy defaults

- Status: accepted
- Date: 2026-08-17

## Context

M0 introduces authenticated writes, independently administered communities, membership and GM admission, community-scoped roles, and public or private schedules. These behaviors need stable defaults before their persistence and user interfaces are built. The defaults must avoid storing passwords, prevent privileges from leaking between communities, and fail closed when visibility or authority is ambiguous.

## Decisions

### Authentication

M0 supports one sign-in method: Google OpenID Connect through a maintained authentication library compatible with the Next.js App Router.

- The application stores Google's immutable `sub` claim as the provider subject. Email address and display name are profile attributes, not identity keys.
- Google owns credential verification, account recovery, and provider-side security controls. Nexus Codex stores no passwords.
- Authentication identity and application person remain separate records. A successful first sign-in creates one `person` and one `auth_identity` in a transaction; later sign-ins resolve by provider plus subject.
- M0 does not link multiple authentication providers to one person.
- Sessions use secure, HTTP-only, same-site cookies, rotate after sign-in and privilege changes, and are invalidated on sign-out. Provider tokens remain server-only and are retained only when a documented application capability requires them.
- Every state-changing operation resolves an authenticated actor and performs authorization again in the application/data-access boundary. Route guards and hidden controls are convenience layers, not security boundaries.

Google was selected because it supplies standards-based OIDC, stable subject identifiers, and provider-managed recovery without requiring Nexus Codex to operate credential storage. Discord account linking remains a later integration concern and must not make a mutable Discord handle an identity key.

### Fixed community roles

Roles are independent, community-scoped grants rather than one escalating enum. Ordinary membership is represented by an active membership, not a role grant.

| Capability | Visitor | Member | GM | Organizer | Administrator | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Discover public community | yes | yes | yes | yes | yes | yes |
| View community/schedule | public policy | member policy | member policy | yes | yes | yes |
| Request membership or redeem invitation | yes | n/a | n/a | n/a | n/a | n/a |
| Request GM status | no | yes | n/a | n/a | n/a | n/a |
| Create and manage a game they GM | no | only through atomic self-service promotion | yes | yes | yes | yes |
| Create, edit, cancel, or staff any community game | no | no | no | yes | yes | yes |
| Invite members and decide membership requests | no | no | no | no | yes | yes |
| Decide, suspend, or revoke GM status | no | no | no | no | yes | yes |
| Grant or revoke organizer role | no | no | no | no | yes | yes |
| Grant or revoke administrator role | no | no | no | no | no | yes |
| Change community policies and profile settings | no | no | no | no | no | yes |
| Archive, restore, or transfer ownership | no | no | no | no | no | yes |

Additional constraints:

- A GM grant provides no organizer or membership-management authority.
- An organizer grant provides no membership, GM-admission, role-management, or settings authority.
- An administrator cannot grant administrator or owner authority.
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

Only an owner, administrator, or organizer may save an exceptional capacity, and a nonblank reason is required. A GM without another administrative grant cannot override the normal range. The exception records actor, reason, timestamp, and requested capacity. M0 treats this as an operational scheduling exception, not a ruling that the eventual table is legal; scenario-specific legality belongs to M2.

### Invitations

- Invitations use a cryptographically random token with at least 256 bits of entropy; only a one-way token hash is stored.
- Default expiry is 7 days. An owner or administrator may choose 1 through 30 days.
- Invitations are single-use, revocable, and scoped to exactly one community.
- An invitation may target an existing person or an email address, or be explicitly created as a claimable link. Targeted invitations may be accepted only by the intended signed-in identity.
- Possessing an invitation permits entry into the admission flow; it does not bypass the community's membership approval mode. With the default manual mode, acceptance creates a pending request.
- Invitations request ordinary membership only. Administrator, organizer, GM, and owner authority require their separate audited workflows.
- Expired, revoked, already-used, malformed, and unknown tokens return the same public failure response.
- Raw tokens and intended email addresses do not appear in application logs, analytics, referrers, or error details. Redemption is rate-limited and idempotent.

## Consequences

- M0-02 can implement one narrow authentication path without designing password storage or provider linking.
- Community queries and application services must accept actor context and evaluate current grants close to the database operation.
- A newly created community is safe before its owner completes configuration.
- Public discovery, public schedules, and location disclosure remain three distinct decisions.
- The fixed matrix may be less flexible than custom RBAC, but it is reviewable and testable for M0. Custom permission builders remain out of scope.
- Capacity exceptions remain auditable without embedding the later eligibility engine in scheduling.

## Required verification in later tickets

- Test provider-subject identity resolution independently from email and display name.
- Test every role against both its own community and an unrelated community.
- Test private-community nonexistence behavior across profile, schedule, session, search, counts, and autocomplete.
- Test that policy changes affect future actions without silently rewriting pending requests or existing grants.
- Test invitation replay, expiry, revocation, targeting, hashing, rate limiting, and log redaction.
- Test normal, exceptional, and hard-rejected capacity values, including override authorization and audit history.

## References

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js data-security guide](https://nextjs.org/docs/app/guides/data-security)
- [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
