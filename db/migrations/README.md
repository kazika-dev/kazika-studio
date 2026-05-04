# Database migrations

SQL migration files for the `kazikastudio` PostgreSQL schema.

These files are applied against the configured Postgres/Neon database with the scripts in `scripts/`.

```bash
node scripts/run-migration.js db/migrations/<migration-file>.sql
node scripts/run-migrations.js
```
