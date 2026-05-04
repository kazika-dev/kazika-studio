import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'kazikastudio'
       ORDER BY table_name
       LIMIT 200`
    );

    return NextResponse.json({ success: true, tables: result.rows });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
