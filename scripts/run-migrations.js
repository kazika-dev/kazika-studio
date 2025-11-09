/**
 * Run database migrations with tracking
 * This script tracks which migrations have been run to prevent data loss
 * Usage: node scripts/run-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runMigrations() {
  // Database connection configuration
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
    console.log('✓ Connected to database');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS kazikastudio.schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    console.log('✓ Migration tracking table ready');

    // Get already executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT migration_name FROM kazikastudio.schema_migrations'
    );
    const executedSet = new Set(executedMigrations.map(r => r.migration_name));

    // Get migration files
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('README'))
      .sort(); // Sort to ensure order

    console.log(`\nFound ${files.length} migration files`);
    console.log(`Already executed: ${executedSet.size} migrations`);

    // Run each migration
    for (const file of files) {
      if (executedSet.has(file)) {
        console.log(`\n⚠ Skipped (already executed): ${file}`);
        continue;
      }

      console.log(`\n→ Running migration: ${file}`);

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        // Begin transaction
        await client.query('BEGIN');

        // Execute migration
        await client.query(sql);

        // Record migration as executed
        await client.query(
          'INSERT INTO kazikastudio.schema_migrations (migration_name) VALUES ($1)',
          [file]
        );

        // Commit transaction
        await client.query('COMMIT');

        console.log(`✓ Successfully executed: ${file}`);
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');

        // Check if error is about object already existing
        if (error.message.includes('already exists')) {
          console.log(`⚠ Skipped (already exists): ${file}`);
          // Still record it as executed to avoid future attempts
          await client.query(
            'INSERT INTO kazikastudio.schema_migrations (migration_name) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
        } else {
          console.error(`✗ Failed to execute: ${file}`);
          throw error;
        }
      }
    }

    console.log('\n✓ All migrations completed successfully!\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✓ Database connection closed');
  }
}

runMigrations();
