import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// データベース接続とテーブル存在確認
export async function GET() {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // テーブルの存在確認
    const { data: tablesData, error: tablesError } = await supabase
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
