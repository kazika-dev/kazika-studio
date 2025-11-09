import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/test-db
 * Test database connection and check if conversation tables exist
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Test conversations table
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);

    // Test conversation_messages table
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*')
      .limit(5);

    // Test character_sheets for conversation fields
    const { data: characters, error: charError } = await supabase
      .from('character_sheets')
      .select('id, name, personality, speaking_style, sample_dialogues')
      .limit(5);

    return NextResponse.json({
      success: true,
      tables: {
        conversations: {
          exists: !convError,
          error: convError?.message || null,
          count: conversations?.length || 0,
          sample: conversations?.[0] || null
        },
        conversation_messages: {
          exists: !msgError,
          error: msgError?.message || null,
          count: messages?.length || 0
        },
        character_sheets: {
          exists: !charError,
          error: charError?.message || null,
          count: characters?.length || 0,
          hasConversationFields: characters?.[0]?.personality !== undefined
        }
      }
    });

  } catch (error: any) {
    console.error('Test DB error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
