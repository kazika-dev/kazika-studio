import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/characters
 * Get all character sheets for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[GET /api/characters] Fetching all characters for user:', user.id);

    // Get all character sheets for the user
    const { data: characters, error: charError } = await supabase
      .from('character_sheets')
      .select('id, name, image_url, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (charError) {
      console.error('[GET /api/characters] Error fetching characters:', charError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch characters' },
        { status: 500 }
      );
    }

    console.log('[GET /api/characters] Found characters:', characters?.length || 0);

    return NextResponse.json({
      success: true,
      data: {
        characters: characters || []
      }
    });

  } catch (error: any) {
    console.error('Get characters error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
