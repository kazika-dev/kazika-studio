import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'kazikastudio'
  }
});

async function checkConversationScenes() {
  console.log('=== Checking conversation_scenes table ===\n');

  try {
    // Try to query the table
    const { data, error, count } = await supabase
      .from('conversation_scenes')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error accessing conversation_scenes table:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('\n   → The table likely does not exist in kazikastudio schema\n');
    } else {
      console.log('✅ Table exists!');
      console.log('   Total rows:', count);

      // Get sample data
      const { data: samples } = await supabase
        .from('conversation_scenes')
        .select('*')
        .limit(5);

      if (samples && samples.length > 0) {
        console.log('\n   Sample data:');
        console.log(JSON.stringify(samples, null, 2));
      } else {
        console.log('\n   Table is empty (no rows)');
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  // Check recent conversations
  console.log('\n=== Checking recent conversations ===\n');
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching conversations:', error.message);
    } else {
      console.log(`Found ${conversations?.length || 0} recent conversations:`);
      conversations?.forEach(conv => {
        console.log(`  - [${conv.id}] ${conv.title} (${new Date(conv.created_at).toLocaleString()})`);
      });

      // For each conversation, try to check scenes
      if (conversations && conversations.length > 0) {
        console.log('\n=== Checking scenes for each conversation ===\n');

        for (const conv of conversations) {
          const { data: scenes, count, error: sceneError } = await supabase
            .from('conversation_scenes')
            .select('*', { count: 'exact' })
            .eq('conversation_id', conv.id);

          if (sceneError) {
            console.log(`  Conversation ${conv.id}: ❌ Error - ${sceneError.message}`);
          } else {
            console.log(`  Conversation ${conv.id} (${conv.title}):`);
            console.log(`    → ${count || 0} scenes`);
            if (scenes && scenes.length > 0) {
              console.log('    Data:', JSON.stringify(scenes, null, 6));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Exception checking conversations:', err.message);
  }
}

checkConversationScenes().catch(console.error);
