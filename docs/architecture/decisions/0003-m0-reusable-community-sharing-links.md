# ADR 0003: M0 reusable community sharing links

- Status: accepted
- Date: 2026-08-17
- Supersedes: the Invitations section of [ADR 0002](0002-m0-identity-and-policy-defaults.md)

## Context

The original M0 admission design used recipient-bound, single-use invitations whose raw token was returned only when the invitation was created. During implementation, the product direction changed toward links that community owners can share through whatever communication channel they already use. Nexus Codex does not need to send invitation email in M0.

Owners also need to manage links after creation: see which links can still admit people, copy them again, understand their remaining capacity, and revoke them. This requires a token design that remains secret at rest while allowing an authorized owner to recover the same link later.

## Decisions

### Sharing-link lifecycle

- M0 invitations are community-scoped, claimable sharing links rather than email-addressed invitations.
- Only a current community owner may create, list, or revoke sharing links. UI visibility is not an authorization boundary; each operation reauthorizes against current database state.
- At creation, the owner chooses a maximum of 1, 2, 5, 10, 25, or 100 distinct users, or unlimited use.
- One signed-in person consumes at most one use of a link. Retrying or replaying the same accepted link as that person is idempotent and consumes no additional use.
- A finite link becomes exhausted when its distinct-user count reaches its maximum. An unlimited link remains active until it expires or an owner revokes it.
- An owner may revoke any unexpired link that still has capacity. Revocation prevents later admission attempts and retains its audit history.
- The owner settings page lists active links, their exact number of uses remaining (or `unlimited`), uses already consumed, expiry date, and a revocation control.
- A newly created link is highlighted in that active-links list. It is not rendered separately with “copy it now” or “won’t be shown again” language because it remains available to the owner.
- Expired, exhausted, and revoked links are not presented as active links.

### Token handling and privacy

- The bearer token is derived with HMAC-SHA-256 from the invitation identifier and the server-only Better Auth secret. The database stores only the token’s SHA-256 digest, never the bearer token itself.
- The same bearer token may be reconstructed only inside an owner-authorized server operation so an active link can be displayed again without persisting raw bearer credentials.
- Public redemption compares the presented token’s digest with the stored digest. Invalid, unknown, expired, exhausted, and revoked links return the same nonrevealing result.
- A successful redemption redirects away from the token-bearing URL. Tokens must not enter audit details, application logs, analytics, error messages, or post-redemption URLs.
- Acceptance, exhaustion, expiry, and revocation are concurrency-safe and preserve privacy-safe audit history.

### Admission behavior

- Possessing a valid link starts admission to its community; it grants ordinary membership only and does not grant GM or owner authority.
- The community’s current membership-approval policy is captured when a new admission attempt begins. Automatic policy creates the membership transactionally; manual policy creates a pending request with no member access.
- Later community-policy changes do not rewrite a pending or decided request’s captured policy or decision history.
- Pending requests may be approved or rejected only by a current owner. Requesters may cancel their own pending requests.

### Deferred delivery and navigation

- Email invitation delivery is out of scope for M0. Owners copy sharing links and distribute them through external channels.
- A shared application header, relocation of the sign-out control, and in-app notifications for pending membership requests and applicant status changes are deferred to [issue #35](https://github.com/nicholepatrisse/nexus-codex/issues/35).

## Consequences

- Owners can recover and manage active sharing links, so the interface must treat every rendered link as a sensitive bearer credential and keep the settings route owner-only.
- Rotating the Better Auth secret invalidates the ability to reconstruct existing sharing links and also changes the application’s authentication secret. Secret rotation therefore requires an explicit operational migration or revocation plan.
- The use limit counts distinct accepted people, not clicks or repeated attempts.
- There is no recipient-email binding or outbound-email dependency in M0.
- The persistence model retains terminal invitation and request records rather than deleting them.

## Required verification

- Verify that only token digests are persisted and that owner listing reconstructs the original redeemable token.
- Verify finite, unlimited, exhausted, expired, and revoked link behavior.
- Verify owner-only creation, listing, and revocation, including fresh authorization and cross-community denial.
- Verify distinct-user counting, same-user replay, concurrent redemption/revocation, and duplicate-membership prevention.
- Verify manual and automatic admission, pending-user access boundaries, policy snapshots, owner decisions, and requester cancellation.
- Verify that public errors and post-redemption routes do not disclose token state, private-community data, or internal decision reasons.
