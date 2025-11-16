const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixPolicies() {
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
    console.log('Fixing RLS policies...\n');

    // Drop old policies
    console.log('Dropping old policies...');
    await client.query(`
      DROP POLICY IF EXISTS "Users can view their conversations" ON kazikastudio.conversations;
      DROP POLICY IF EXISTS "Users can insert their conversations" ON kazikastudio.conversations;
      DROP POLICY IF EXISTS "Users can update their conversations" ON kazikastudio.conversations;
      DROP POLICY IF EXISTS "Users can delete their conversations" ON kazikastudio.conversations;
    `);
    console.log('✓ Old policies dropped\n');

    // Create new policies
    console.log('Creating new policies...');

    await client.query(`
      CREATE POLICY "Users can view their conversations"
        ON kazikastudio.conversations FOR SELECT
        USING (
          user_id = auth.uid()
        );
    `);
    console.log('✓ SELECT policy created');

    await client.query(`
      CREATE POLICY "Users can insert their conversations"
        ON kazikastudio.conversations FOR INSERT
        WITH CHECK (
          user_id = auth.uid()
        );
    `);
    console.log('✓ INSERT policy created');

    await client.query(`
      CREATE POLICY "Users can update their conversations"
        ON kazikastudio.conversations FOR UPDATE
        USING (
          user_id = auth.uid()
        );
    `);
    console.log('✓ UPDATE policy created');

    await client.query(`
      CREATE POLICY "Users can delete their conversations"
        ON kazikastudio.conversations FOR DELETE
        USING (
          user_id = auth.uid()
        );
    `);
    console.log('✓ DELETE policy created\n');

    console.log('✅ All policies updated successfully!');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

fixPolicies();
