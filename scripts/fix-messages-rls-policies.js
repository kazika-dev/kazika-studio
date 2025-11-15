const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixMessagesPolicies() {
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
    console.log('Fixing conversation_messages RLS policies...\n');

    // Drop old policies
    console.log('Dropping old policies...');
    await client.query(`
      DROP POLICY IF EXISTS "Users can view messages in their conversations" ON kazikastudio.conversation_messages;
      DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON kazikastudio.conversation_messages;
      DROP POLICY IF EXISTS "Users can update messages in their conversations" ON kazikastudio.conversation_messages;
      DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON kazikastudio.conversation_messages;
    `);
    console.log('✓ Old policies dropped\n');

    // Create new policies that check via conversations.user_id
    console.log('Creating new policies...');

    await client.query(`
      CREATE POLICY "Users can view messages in their conversations"
        ON kazikastudio.conversation_messages FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM kazikastudio.conversations c
            WHERE c.id = conversation_messages.conversation_id
            AND c.user_id = auth.uid()
          )
        );
    `);
    console.log('✓ SELECT policy created');

    await client.query(`
      CREATE POLICY "Users can insert messages in their conversations"
        ON kazikastudio.conversation_messages FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM kazikastudio.conversations c
            WHERE c.id = conversation_messages.conversation_id
            AND c.user_id = auth.uid()
          )
        );
    `);
    console.log('✓ INSERT policy created');

    await client.query(`
      CREATE POLICY "Users can update messages in their conversations"
        ON kazikastudio.conversation_messages FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM kazikastudio.conversations c
            WHERE c.id = conversation_messages.conversation_id
            AND c.user_id = auth.uid()
          )
        );
    `);
    console.log('✓ UPDATE policy created');

    await client.query(`
      CREATE POLICY "Users can delete messages in their conversations"
        ON kazikastudio.conversation_messages FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM kazikastudio.conversations c
            WHERE c.id = conversation_messages.conversation_id
            AND c.user_id = auth.uid()
          )
        );
    `);
    console.log('✓ DELETE policy created\n');

    console.log('✅ All message policies updated successfully!');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

fixMessagesPolicies();
