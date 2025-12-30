import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  uploadImageToStorage,
  deleteImageFromStorage,
} from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * PUT /api/prop-masters/[id]/replace-image
 * 小物マスタの画像を置き換え
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const propId = parseInt(id);

    if (isNaN(propId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 既存の小物を取得
    const { data: existingProp, error: fetchError } = await supabase
      .from('m_props')
      .select('*')
      .eq('id', propId)
      .single();

    if (fetchError || !existingProp) {
      return NextResponse.json(
        { error: 'Prop not found' },
        { status: 404 }
      );
    }

    // 所有権チェック
    if (existingProp.user_id && existingProp.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed.' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // 古い画像を削除
    if (existingProp.image_url) {
      try {
        await deleteImageFromStorage(existingProp.image_url);
      } catch (error) {
        console.error('Failed to delete old image:', error);
      }
    }

    // 新しい画像をアップロード
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = await uploadImageToStorage(
      base64Data,
      imageFile.type,
      imageFile.name || 'edited-prop.png',
      'props'
    );

    // データベース更新
    const { data: updatedProp, error: updateError } = await supabase
      .from('m_props')
      .update({
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propId)
      .select()
      .single();

    if (updateError || !updatedProp) {
      return NextResponse.json(
        { error: 'Failed to update prop' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prop: updatedProp,
    });
  } catch (error: any) {
    console.error('Prop image replace error:', error);
    return NextResponse.json(
      { error: 'Failed to replace prop image', details: error.message },
      { status: 500 }
    );
  }
}
