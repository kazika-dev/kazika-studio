import { config } from 'dotenv';
import { getPool } from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config({ path: '.env.local' });

async function migrate() {
  const pool = getPool();

  try {
    console.log('Reading migration file...');
    const sqlPath = path.join(__dirname, '../database/comfyui_queue_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Executing migration...');
    await pool.query(sql);

    console.log('✓ Migration completed successfully!');

    // Verify table was created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'kazikastudio'
      AND table_name = 'comfyui_queue'
    `);

    if (result.rows.length > 0) {
      console.log('✓ Table kazikastudio.comfyui_queue created successfully');
    } else {
      console.error('✗ Table was not created');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
