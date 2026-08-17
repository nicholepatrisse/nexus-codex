# Authentication boundary

M0 exposes Better Auth only through `/api/auth/*`. Google is the only configured sign-in provider; password sign-in and account linking are disabled.

Server operations fall into two conventions:

- Public reads do not call the actor helpers and must return only explicitly public fields.
- Protected reads and every write call `requireAuthenticatedActor()` at the application boundary, then authorize the returned `personId` against current database state inside the operation.

Route visibility and hidden controls are user-interface conveniences, not authorization. Session validation is database-backed on every protected operation because cookie session caching is disabled. Tests create identities through `createTestIdentity`; that fixture has no HTTP route, refuses to run outside `NODE_ENV=test`, and never contacts Google.
