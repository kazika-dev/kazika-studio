const { Pool } = require('pg');
const { getDatabaseConnectionConfig } = require('./db-config.js');

async function main() {
  const pool = new Pool(getDatabaseConnectionConfig());
  try {
    await pool.query(`
      ALTER TABLE kazikastudio.character_sheets
      ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT
    `);
    console.log('elevenlabs_voice_id column ensured');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
