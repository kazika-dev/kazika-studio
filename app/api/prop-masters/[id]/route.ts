import { NextRequest, NextResponse } from 'next/server';
import { getPropById, updateProp, deleteProp } from '@/lib/db';
import {
  uploadImageToStorage,
  getSignedUrl,
  deleteImageFromStorage,
} from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/prop-masters/[id]
 * 小物マスタを個別取得（署名付きURL付き）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propId = parseInt(id);

    if (isNaN(propId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const prop = await getPropById(propId);

    if (!prop) {
      return NextResponse.json(
        { error: 'Prop not found' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    let signedUrl: string | undefined;
    if (prop.image_url) {
      signedUrl = await getSignedUrl(prop.image_url, 120);
    }

    return NextResponse.json({
      success: true,
      prop: {
        ...prop,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Prop master fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prop master', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/prop-masters/[id]
 * 小物マスタを更新（画像変更可能）
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

    // 既存の小物を取得
    const existingProp = await getPropById(propId);
    if (!existingProp) {
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
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const promptHintJa = formData.get('prompt_hint_ja') as string;
    const promptHintEn = formData.get('prompt_hint_en') as string;
    const tagsJson = formData.get('tags') as string;
    const imageFile = formData.get('image') as File | null;

    // バリデーション
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // タグのパース
    let tags: string[] = [];
    try {
      tags = tagsJson ? JSON.parse(tagsJson) : [];
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid tags format' },
        { status: 400 }
      );
    }

    let imageUrl = existingProp.image_url;

    // 新しい画像がある場合はアップロード
    if (imageFile && imageFile.size > 0) {
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
      imageUrl = await uploadImageToStorage(
        base64Data,
        imageFile.type,
        imageFile.name,
        'props'
      );
    }

    // データベース更新
    const updatedProp = await updateProp(propId, {
      name: name.trim(),
      description: description?.trim() || '',
      image_url: imageUrl || undefined,
      category: category || undefined,
      prompt_hint_ja: promptHintJa?.trim() || undefined,
      prompt_hint_en: promptHintEn?.trim() || undefined,
      tags,
    });

    if (!updatedProp) {
      return NextResponse.json(
        { error: 'Prop not found' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    let signedUrl: string | undefined;
    if (updatedProp.image_url) {
      signedUrl = await getSignedUrl(updatedProp.image_url, 120);
    }

    return NextResponse.json({
      success: true,
      prop: {
        ...updatedProp,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Prop master update error:', error);
    return NextResponse.json(
      { error: 'Failed to update prop master', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prop-masters/[id]
 * 小物マスタを削除（データベース + GCP Storage）
 */
export async function DELETE(
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

    // 削除前に小物情報を取得
    const prop = await getPropById(propId);

    if (!prop) {
      return NextResponse.json(
        { error: 'Prop not found' },
        { status: 404 }
      );
    }

    // 所有権チェック
    if (prop.user_id && prop.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // データベースから削除
    const deletedProp = await deleteProp(propId);

    if (!deletedProp) {
      return NextResponse.json(
        { error: 'Failed to delete from database' },
        { status: 500 }
      );
    }

    // GCP Storageから画像を削除
    if (prop.image_url) {
      try {
        await deleteImageFromStorage(prop.image_url);
      } catch (error) {
        console.error('Failed to delete from GCP Storage:', error);
        // Storageからの削除に失敗してもデータベースからは削除済みなので警告のみ
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Prop master deleted successfully',
    });
  } catch (error: any) {
    console.error('Prop master deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete prop master', details: error.message },
      { status: 500 }
    );
  }
}
