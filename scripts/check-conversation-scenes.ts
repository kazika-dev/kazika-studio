import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConversationScenes() {
  console.log('Checking conversation_scenes table...\n');

  // Check if table exists and get structure
  const { data: tableInfo, error: tableError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'kazikastudio'
        AND table_name = 'conversation_scenes'
        ORDER BY ordinal_position;
      `
    });

  if (tableError) {
    console.error('Error checking table:', tableError);

    // Try direct query instead
    const { data, error, count } = await supabase
      .from('conversation_scenes')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Table does not exist or cannot be accessed:', error.message);
      return;
    } else {
      console.log('Table exists! Row count:', count);

      // Get sample data
      const { data: samples } = await supabase
        .from('conversation_scenes')
        .select('*')
        .limit(5);

      console.log('\nSample data:', JSON.stringify(samples, null, 2));
    }
  } else {
    console.log('Table structure:', tableInfo);
  }

  // Check recent conversations
  console.log('\n\nChecking recent conversations...');
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Recent conversations:', JSON.stringify(conversations, null, 2));

  if (conversations && conversations.length > 0) {
    // Check if any have scenes
    for (const conv of conversations) {
      const { data: scenes, count } = await supabase
        .from('conversation_scenes')
        .select('*', { count: 'exact' })
        .eq('conversation_id', conv.id);

      console.log(`\nConversation ${conv.id} (${conv.title}): ${count} scenes`);
      if (scenes && scenes.length > 0) {
        console.log('Scenes:', JSON.stringify(scenes, null, 2));
      }
    }
  }
}

checkConversationScenes().catch(console.error);
