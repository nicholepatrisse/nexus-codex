# Repository instructions

## Database migrations

- For every database schema change, generate and commit the corresponding Drizzle SQL migration and metadata.
- Review generated migration SQL, including data backfills and constraints, before applying it.
- Run `pnpm db:check` and `pnpm db:migrate` after generating or changing migrations. Do not consider a schema-changing task complete until the migration has been applied to the local development database successfully.
- Run database-dependent tests against the migrated schema when available.
- Use `pnpm db:deploy` for committed migrations in deployed non-production environments and `pnpm db:deploy:production` for production. Never place production credentials in repository files or command history.
- Production migrations run automatically after verification succeeds on pushes to `main`. Keep that job dependent on CI, serialized through its concurrency group, and scoped to the protected `production` GitHub environment and its `PRODUCTION_DATABASE_URL` secret.
