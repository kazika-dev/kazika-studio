const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkPolicies() {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Checking RLS policies on conversations table...\n');

    const result = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'kazikastudio'
      AND tablename = 'conversations'
      ORDER BY policyname;
    `);

    console.log('Current policies:');
    result.rows.forEach(row => {
      console.log(`  - ${row.policyname} (${row.cmd})`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkPolicies();
