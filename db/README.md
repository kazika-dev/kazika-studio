# Database migrations

This directory contains SQL migrations for the `kazikastudio` PostgreSQL schema.

The application now uses Neon/Postgres directly plus Auth.js for authentication. Legacy hosted auth/client SDKs are no longer part of the runtime.

## Running migrations

Use the local migration scripts with a database connection configured by one of:

- `DATABASE_URL`
- `NEON_DB`
- `NEON_DATABASE_URL`
- `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / optional `DB_PORT`

Examples:

```bash
node scripts/run-migration.js db/migrations/<migration-file>.sql
node scripts/run-migrations.js
```
