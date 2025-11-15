import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const results: any = {
    tableExists: false,
    tableStructure: null,
    rowCount: 0,
    sampleData: [],
    recentConversations: [],
    conversationScenes: {}
  };

  try {
    // Try to query the table
    const { data, error, count } = await supabase
      .from('conversation_scenes')
      .select('*', { count: 'exact', head: true });

    if (error) {
      results.error = error.message;
      results.tableExists = false;
    } else {
      results.tableExists = true;
      results.rowCount = count || 0;

      // Get sample data
      const { data: samples } = await supabase
        .from('conversation_scenes')
        .select('*')
        .limit(10);

      results.sampleData = samples || [];
    }

    // Check recent conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    results.recentConversations = conversations || [];

    // For each conversation, check scenes
    if (conversations) {
      for (const conv of conversations) {
        const { data: scenes, count: sceneCount } = await supabase
          .from('conversation_scenes')
          .select('*', { count: 'exact' })
          .eq('conversation_id', conv.id);

        results.conversationScenes[conv.id] = {
          conversationTitle: conv.title,
          sceneCount: sceneCount || 0,
          scenes: scenes || []
        };
      }
    }
  } catch (err: any) {
    results.exception = err.message;
  }

  return NextResponse.json(results, { status: 200 });
}
