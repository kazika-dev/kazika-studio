import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Node } from 'reactflow';

/**
 * ノード情報からform_configを自動生成
 */
function generateFormConfig(nodes: Node[]): any {
  const fields: any[] = [];

  nodes.forEach((node: Node) => {
    const nodeType = node.data.type;
    const nodeId = node.id;
    const nodeName = node.data.config?.name || nodeId;

    // 入力ノード
    if (nodeType === 'input') {
      fields.push({
        name: `input_${nodeId}`,
        label: nodeName,
        type: 'text',
        required: false,
        description: node.data.config?.description || 'データの入力を受け付けます',
      });
    }

    // 画像入力ノード
    if (nodeType === 'imageInput') {
      fields.push({
        name: `image_${nodeId}`,
        label: nodeName,
        type: 'image',
        required: false,
        description: node.data.config?.description || '画像を入力します',
      });
    }

    // プロンプトを持つノード (Gemini, Nanobana, Higgsfield, Seedream4)
    if (['gemini', 'nanobana', 'higgsfield', 'seedream4'].includes(nodeType)) {
      fields.push({
        name: `${nodeType}_prompt_${nodeId}`,
        label: `${nodeName} プロンプト`,
        type: 'textarea',
        required: false,
        description: node.data.config?.description || 'プロンプトを入力します',
        placeholder: node.data.config?.prompt || '',
      });
    }
  });

  return fields.length > 0 ? { fields } : null;
}

// ワークフロー一覧取得
export async function GET() {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLSポリシーにより、自動的にuser_idでフィルタリングされる
    const { data, error } = await supabase
      .from('workflows')
      .select('id, name, description, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      workflows: data,
    });
  } catch (error: any) {
    console.error('Workflow fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch workflows',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// ワークフロー保存
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, nodes, edges, form_config } = await request.json();

    if (!name || !nodes || !edges) {
      return NextResponse.json(
        { error: 'Name, nodes, and edges are required' },
        { status: 400 }
      );
    }

    // form_configを自動生成（手動設定がなければ）
    const finalFormConfig = form_config || generateFormConfig(nodes);

    console.log('Creating workflow with auto-generated form_config:', finalFormConfig);

    // user_idを自動設定してRLSポリシーを適用
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name,
        description: description || '',
        nodes,
        edges,
        form_config: finalFormConfig,
        user_id: user.id,
      })
      .select('id, name, description, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      workflow: data,
    });
  } catch (error: any) {
    console.error('Workflow save error - Full error object:', JSON.stringify(error, null, 2));
    console.error('Workflow save error - Error type:', typeof error);
    console.error('Workflow save error - Error keys:', Object.keys(error));
    console.error('Workflow save error - Stack:', error?.stack);
    return NextResponse.json(
      {
        error: 'Failed to save workflow',
        details: error?.message || String(error),
        code: error?.code,
        hint: error?.hint,
        fullError: JSON.stringify(error),
      },
      { status: 500 }
    );
  }
}

// ワークフロー更新
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, description, nodes, edges, form_config } = await request.json();

    if (!id || !name || !nodes || !edges) {
      return NextResponse.json(
        { error: 'ID, name, nodes, and edges are required' },
        { status: 400 }
      );
    }

    // form_configを自動生成（手動設定がなければ）
    const finalFormConfig = form_config || generateFormConfig(nodes);

    console.log('Updating workflow with auto-generated form_config:', finalFormConfig);

    // RLSポリシーにより、自分のワークフローのみ更新可能
    const { data, error } = await supabase
      .from('workflows')
      .update({
        name,
        description: description || '',
        nodes,
        edges,
        form_config: finalFormConfig,
      })
      .eq('id', id)
      .select('id, name, description, created_at, updated_at')
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
    console.error('Workflow update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update workflow',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// ワークフロー削除
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // RLSポリシーにより、自分のワークフローのみ削除可能
    const { error } = await supabase.from('workflows').delete().eq('id', id);

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
      message: 'Workflow deleted successfully',
    });
  } catch (error: any) {
    console.error('Workflow delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete workflow',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
