import type { PoolConfig } from 'pg';

function buildConnectionString(prefix: 'DB') {
  const host = process.env[`${prefix}_HOST`];
  const name = process.env[`${prefix}_NAME`];
  const user = process.env[`${prefix}_USER`];
  const password = process.env[`${prefix}_PASSWORD`];
  const port = process.env[`${prefix}_PORT`] || '5432';

  if (!host || !name || !user || !password) {
    return null;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export function getDatabaseUrl() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NEON_DB ||
    process.env.NEON_DATABASE_URL ||
    buildConnectionString('DB');

  if (!connectionString) {
    throw new Error(
      'Database connection is not configured. Set DATABASE_URL, NEON_DB, NEON_DATABASE_URL, or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.'
    );
  }

  return connectionString;
}

export function getDatabaseSslConfig(): PoolConfig['ssl'] {
  if (process.env.DB_SSL === 'false' || process.env.PGSSLMODE === 'disable') {
    return false;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  };
}

export function getDatabasePoolConfig(): PoolConfig {
  return {
    connectionString: getDatabaseUrl(),
    ssl: getDatabaseSslConfig(),
  };
}
