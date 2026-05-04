function buildConnectionString(prefix) {
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

function getDatabaseUrl() {
  const connectionString =
    process.env.NEON_DB ||
    buildConnectionString('DB');

  if (!connectionString) {
    throw new Error(
      'Database connection is not configured. Set NEON_DB or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.'
    );
  }

  return connectionString;
}

function getDatabaseSslConfig() {
  if (process.env.DB_SSL === 'false' || process.env.PGSSLMODE === 'disable') {
    return false;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  };
}

function getDatabaseConnectionConfig() {
  return {
    connectionString: getDatabaseUrl(),
    ssl: getDatabaseSslConfig(),
  };
}

module.exports = {
  getDatabaseConnectionConfig,
  getDatabaseSslConfig,
  getDatabaseUrl,
};
