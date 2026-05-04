import { NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';

// データベース接続とテーブル存在確認
export async function GET() {
  try {
    const db = await createKazikaClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    // テーブルの存在確認
    const { data: tablesData, error: tablesError } = await db
      .from('workflows')
      .select('count')
      .limit(0);

    return NextResponse.json({
      success: true,
      user: user ? { id: user.id, email: user.email } : null,
      authError: authError ? authError.message : null,
      workflowsTableExists: !tablesError,
      tablesError: tablesError ? {
        message: tablesError.message,
        code: tablesError.code,
        details: tablesError.details,
        hint: tablesError.hint,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
