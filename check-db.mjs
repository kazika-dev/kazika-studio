import pg from 'pg';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getDatabaseConnectionConfig } = require('./scripts/db-config.js');
const { Pool } = pg;
const pool = new Pool(getDatabaseConnectionConfig());

try {
  const result = await pool.query('select now() as now');
  console.log('Neon connection OK:', result.rows[0].now);
} finally {
  await pool.end();
}
