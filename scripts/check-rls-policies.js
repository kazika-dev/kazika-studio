const { Client } = require('pg');
const { getDatabaseConnectionConfig } = require('./db-config');
require('dotenv').config({ path: '.env.local' });

async function checkPolicies() {
  const client = new Client({
    ...getDatabaseConnectionConfig(),
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
