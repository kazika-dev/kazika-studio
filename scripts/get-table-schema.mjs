import pg from 'pg';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config({ path: '.env.local' });

const require = createRequire(import.meta.url);
const { getDatabaseConnectionConfig } = require('./db-config.js');
const { Pool } = pg;
const pool = new Pool(getDatabaseConnectionConfig());

const tables = [
  'm_camera_angles',
  'm_camera_movements',
  'm_shot_distances',
];

try {
  for (const tableName of tables) {
    console.log(`\n=== kazikastudio.${tableName} ===`);
    const result = await pool.query(`SELECT * FROM kazikastudio.${tableName} LIMIT 3`);
    console.log(`Row count: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`Columns: ${Object.keys(result.rows[0]).join(', ')}`);
      console.log(JSON.stringify(result.rows, null, 2));
    }
  }
} finally {
  await pool.end();
}
