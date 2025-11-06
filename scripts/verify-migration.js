/**
 * マイグレーション検証スクリプト
 * character_sheetsテーブルがkazikastudioスキーマに正しく移行されたか確認します
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function verifyMigration() {
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
    console.log('Connected successfully\n');

    // publicスキーマにcharacter_sheetsテーブルが存在しないことを確認
    console.log('1. Checking if public.character_sheets exists...');
    const publicTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'character_sheets'
      );
    `);
    const publicExists = publicTableCheck.rows[0].exists;
    console.log(`   public.character_sheets exists: ${publicExists ? '❌ YES (should be removed)' : '✓ NO (correct)'}`);

    // kazikastudioスキーマにcharacter_sheetsテーブルが存在することを確認
    console.log('\n2. Checking if kazikastudio.character_sheets exists...');
    const kazikastudioTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'kazikastudio'
        AND table_name = 'character_sheets'
      );
    `);
    const kazikastudioExists = kazikastudioTableCheck.rows[0].exists;
    console.log(`   kazikastudio.character_sheets exists: ${kazikastudioExists ? '✓ YES (correct)' : '❌ NO (error)'}`);

    if (kazikastudioExists) {
      // テーブルの構造を確認
      console.log('\n3. Checking table structure...');
      const columnsResult = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'kazikastudio'
        AND table_name = 'character_sheets'
        ORDER BY ordinal_position;
      `);
      console.log('   Columns:');
      columnsResult.rows.forEach(row => {
        console.log(`     - ${row.column_name} (${row.data_type})`);
      });

      // レコード数を確認
      console.log('\n4. Checking record count...');
      const countResult = await client.query(`
        SELECT COUNT(*) as count FROM kazikastudio.character_sheets;
      `);
      console.log(`   Total records: ${countResult.rows[0].count}`);

      // RLSポリシーを確認
      console.log('\n5. Checking RLS policies...');
      const policiesResult = await client.query(`
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'kazikastudio'
        AND tablename = 'character_sheets';
      `);
      console.log('   Policies:');
      policiesResult.rows.forEach(row => {
        console.log(`     ✓ ${row.policyname}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    if (!publicExists && kazikastudioExists) {
      console.log('✓ Migration verification PASSED');
    } else {
      console.log('❌ Migration verification FAILED');
    }
    console.log('='.repeat(60));

    client.release();
  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 検証実行
verifyMigration()
  .then(() => {
    console.log('\nVerification process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nVerification process failed:', error);
    process.exit(1);
  });
