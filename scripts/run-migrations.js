const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// .env.localファイルを読み込んで環境変数に設定
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    }
  }
}

async function runMigrations() {
  // DATABASE_URLまたは個別の環境変数から接続
  const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

  if (!connectionString || connectionString === 'postgresql://undefined:undefined@undefined:undefined/undefined') {
    console.error('Database connection environment variables are not set');
    console.error('Required: SUPABASE_DB_HOST, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_PORT');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('Connected successfully\n');

    // マイグレーションファイル
    const migrations = [
      '20251103000001_create_studios_tables.sql',
      '20251103000002_create_board_workflow_steps.sql',
    ];

    for (const migrationFile of migrations) {
      const filePath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);

      console.log(`Running migration: ${migrationFile}`);

      if (!fs.existsSync(filePath)) {
        console.error(`Migration file not found: ${filePath}`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await pool.query(sql);
        console.log(`✓ Successfully applied: ${migrationFile}\n`);
      } catch (error) {
        console.error(`✗ Error applying ${migrationFile}:`, error.message);
        console.error('Detail:', error.detail);
        console.error('Hint:', error.hint);
        console.error('\n');
        // Continue with next migration
      }
    }

    console.log('Migration process completed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
