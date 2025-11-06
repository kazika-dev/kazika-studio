/**
 * マイグレーションスクリプト実行ツール
 * 指定したSQLファイルを実行します
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function runMigration(sqlFilePath) {
  // データベース接続設定
  const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected successfully');

    // SQLファイルを読み込む
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`\nExecuting migration: ${path.basename(sqlFilePath)}`);
    console.log('='.repeat(60));

    // マイグレーションを実行
    await client.query(sqlContent);

    console.log('='.repeat(60));
    console.log('✓ Migration completed successfully');

    client.release();
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// コマンドライン引数からSQLファイルパスを取得
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-migration.js <migration-file.sql>');
  console.error('Example: node scripts/run-migration.js supabase/migrations/20251106000001_move_character_sheets_to_kazikastudio.sql');
  process.exit(1);
}

const sqlFilePath = args[0];

// ファイルの存在を確認
if (!fs.existsSync(sqlFilePath)) {
  console.error(`Error: File not found: ${sqlFilePath}`);
  process.exit(1);
}

// マイグレーション実行
runMigration(sqlFilePath)
  .then(() => {
    console.log('\nMigration process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration process failed:', error);
    process.exit(1);
  });
