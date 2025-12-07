import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // RLSポリシーにより、自動的にuser_idでフィルタリングされる
    const { data, error } = await supabase
      .from('workflows')
      .select('id, name, description, nodes, edges, form_config, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      workflow: data,
    });
  } catch (error: any) {
    console.error('Workflow fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch workflow',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
