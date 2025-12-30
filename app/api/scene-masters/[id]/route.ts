import { NextRequest, NextResponse } from 'next/server';
import { getSceneMasterById, updateSceneMaster, deleteSceneMaster } from '@/lib/db';
import {
  uploadImageToStorage,
  getSignedUrl,
  deleteImageFromStorage,
} from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/scene-masters/[id]
 * シーンマスタを個別取得（署名付きURL付き）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sceneId = parseInt(id);

    if (isNaN(sceneId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const scene = await getSceneMasterById(sceneId);

    if (!scene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    let signedUrl: string | undefined;
    if (scene.image_url) {
      signedUrl = await getSignedUrl(scene.image_url, 120);
    }

    return NextResponse.json({
      success: true,
      scene: {
        ...scene,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Scene master fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene master', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/scene-masters/[id]
 * シーンマスタを更新（画像変更可能）
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
    const sceneId = parseInt(id);

    if (isNaN(sceneId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // 既存のシーンを取得
    const existingScene = await getSceneMasterById(sceneId);
    if (!existingScene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 所有権チェック
    if (existingScene.user_id && existingScene.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const location = formData.get('location') as string;
    const timeOfDay = formData.get('time_of_day') as string;
    const weather = formData.get('weather') as string;
    const mood = formData.get('mood') as string;
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

    let imageUrl = existingScene.image_url;

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
      if (existingScene.image_url) {
        try {
          await deleteImageFromStorage(existingScene.image_url);
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
        'scenes'
      );
    }

    // データベース更新
    const updatedScene = await updateSceneMaster(sceneId, {
      name: name.trim(),
      description: description?.trim() || '',
      image_url: imageUrl || undefined,
      location: location || undefined,
      time_of_day: timeOfDay || undefined,
      weather: weather || undefined,
      mood: mood || undefined,
      prompt_hint_ja: promptHintJa?.trim() || undefined,
      prompt_hint_en: promptHintEn?.trim() || undefined,
      tags,
    });

    if (!updatedScene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    let signedUrl: string | undefined;
    if (updatedScene.image_url) {
      signedUrl = await getSignedUrl(updatedScene.image_url, 120);
    }

    return NextResponse.json({
      success: true,
      scene: {
        ...updatedScene,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Scene master update error:', error);
    return NextResponse.json(
      { error: 'Failed to update scene master', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scene-masters/[id]
 * シーンマスタを削除（データベース + GCP Storage）
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
    const sceneId = parseInt(id);

    if (isNaN(sceneId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // 削除前にシーン情報を取得
    const scene = await getSceneMasterById(sceneId);

    if (!scene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 所有権チェック
    if (scene.user_id && scene.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // データベースから削除
    const deletedScene = await deleteSceneMaster(sceneId);

    if (!deletedScene) {
      return NextResponse.json(
        { error: 'Failed to delete from database' },
        { status: 500 }
      );
    }

    // GCP Storageから画像を削除
    if (scene.image_url) {
      try {
        await deleteImageFromStorage(scene.image_url);
      } catch (error) {
        console.error('Failed to delete from GCP Storage:', error);
        // Storageからの削除に失敗してもデータベースからは削除済みなので警告のみ
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Scene master deleted successfully',
    });
  } catch (error: any) {
    console.error('Scene master deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete scene master', details: error.message },
      { status: 500 }
    );
  }
}
