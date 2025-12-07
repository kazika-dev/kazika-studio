import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { isFavorite } = await request.json();
    const { id } = await params;
    const outputId = parseInt(id);

    if (isNaN(outputId)) {
      return NextResponse.json({ error: 'Invalid output ID' }, { status: 400 });
    }

    // Update favorite column
    const { error: updateError } = await supabase
      .from('workflow_outputs')
      .update({ favorite: isFavorite })
      .eq('id', outputId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating favorite status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update favorite status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, isFavorite });
  } catch (error) {
    console.error('Error in favorite PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
