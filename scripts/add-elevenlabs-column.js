/**
 * Add elevenlabs_voice_id column to character_sheets table
 * This script uses the Supabase client to execute the migration
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function addElevenLabsColumn() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing required environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('Adding elevenlabs_voice_id column to character_sheets table...');

  try {
    // Execute the SQL to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE kazikastudio.character_sheets
        ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT;

        COMMENT ON COLUMN kazikastudio.character_sheets.elevenlabs_voice_id IS 'ElevenLabs API用の音声ID';
      `
    });

    if (error) {
      // If RPC doesn't exist, try direct query
      console.log('RPC method not available, trying direct query...');

      const { error: queryError } = await supabase
        .from('character_sheets')
        .select('elevenlabs_voice_id')
        .limit(1);

      if (queryError && queryError.code === '42703') {
        // Column doesn't exist, we need to add it manually through Supabase dashboard
        console.error('\n❌ Unable to add column automatically.');
        console.error('\nPlease add the column manually:');
        console.error('1. Go to Supabase Dashboard > Table Editor');
        console.error('2. Select "character_sheets" table');
        console.error('3. Click "New Column"');
        console.error('4. Name: elevenlabs_voice_id');
        console.error('5. Type: text');
        console.error('6. Click "Save"');
        process.exit(1);
      } else if (!queryError) {
        console.log('✓ Column already exists!');
      }
    } else {
      console.log('✓ Successfully added elevenlabs_voice_id column');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nPlease add the column manually through Supabase Dashboard');
    process.exit(1);
  }
}

addElevenLabsColumn();
