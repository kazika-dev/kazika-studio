import { NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';

import { query } from '@/lib/db';
/**
 * GET /api/characters
 * Get all character sheets for the authenticated user
 */
export async function GET() {
  try {
    const db = await createKazikaClient();

    // Authentication check
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[GET /api/characters] Fetching all characters for user:', user.id);

    // Get all non-deleted character sheets for the user.
    // Legacy/non-canonical sheets are soft-deleted via metadata.logical_deleted.
    const charactersResult = await query(
      `select id, name, image_url, description
       from kazikastudio.character_sheets
       where user_id = $1
         and coalesce((metadata->>'logical_deleted')::boolean, false) = false
       order by created_at desc`,
      [user.id]
    );

    console.log('[GET /api/characters] Found characters:', charactersResult.rows.length || 0);

    return NextResponse.json({
      success: true,
      data: {
        characters: charactersResult.rows || []
      }
    });

  } catch (error: unknown) {
    console.error('Get characters error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
