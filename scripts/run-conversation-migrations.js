/**
 * Run conversation system migrations only
 * Usage: node scripts/run-conversation-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runConversationMigrations() {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected to database\n');

    // Conversation system migration files only
    const migrationFiles = [
      '20251109000001_create_conversations_tables.sql',
      '20251109000002_add_conversation_fields_to_character_sheets.sql',
      '20251109000003_add_user_id_to_conversations.sql'
    ];

    const migrationsDir = path.join(__dirname, '../supabase/migrations');

    for (const file of migrationFiles) {
      console.log(`→ Running migration: ${file}`);

      const filePath = path.join(migrationsDir, file);
      
      if (!fs.existsSync(filePath)) {
        console.error(`✗ Migration file not found: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✓ Successfully executed: ${file}\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠ Skipped (already exists): ${file}\n`);
        } else {
          console.error(`✗ Error executing ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✓ All conversation migrations completed successfully!\n');

    // Verify tables were created
    console.log('Verifying tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'kazikastudio' 
      AND table_name IN ('conversations', 'conversation_messages', 'conversation_generation_logs')
      ORDER BY table_name;
    `);

    console.log('\nCreated tables:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Verify character_sheets columns
    const colResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'kazikastudio' 
      AND table_name = 'character_sheets'
      AND column_name IN ('personality', 'speaking_style', 'sample_dialogues')
      ORDER BY column_name;
    `);

    console.log('\nAdded columns to character_sheets:');
    colResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });

    console.log('\n✅ Conversation system is ready to use!\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✓ Database connection closed');
  }
}

runConversationMigrations();
