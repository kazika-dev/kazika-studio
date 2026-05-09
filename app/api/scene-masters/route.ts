import { NextRequest, NextResponse } from 'next/server';
import { getSceneMastersByUserId, getSceneMastersPageByUserId, createSceneMaster, createSceneAsset } from '@/lib/db';
import { uploadImageToStorage } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * GET /api/scene-masters
 * シーンマスタ一覧を取得（Next APIストレージプロキシURL付き）
 * lib/db.tsの関数を使用（RLSをバイパス）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pageParam = request.nextUrl.searchParams.get('page');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const hasPagination = pageParam !== null || limitParam !== null;
    const page = Math.max(0, Number.parseInt(pageParam || '0', 10) || 0);
    const limit = Math.max(1, Math.min(100, Number.parseInt(limitParam || '20', 10) || 20));

    // lib/db.tsの関数を使用（PostgreSQL直接接続、RLSバイパス）
    const { scenes, total } = hasPagination
      ? await getSceneMastersPageByUserId(user.id, { limit, offset: page * limit })
      : { scenes: await getSceneMastersByUserId(user.id), total: undefined };

    console.log('[Scene Masters] Query result:', {
      userId: user.id,
      count: scenes.length,
      total,
      page: hasPagination ? page : undefined,
      limit: hasPagination ? limit : undefined,
    });

    // GCS署名付きURLではなく、認証済みNext APIプロキシ経由のURLを返す
    const scenesWithUrls = scenes.map((scene) => ({
      ...scene,
      signed_url: scene.image_url ? `/api/storage/${scene.image_url}` : undefined,
      scene_assets: (scene.scene_assets || []).map((asset) => ({
        ...asset,
        signed_url: `/api/storage/${asset.content_url}`,
      })),
      scene_images: (scene.scene_images || []).map((image) => ({
        ...image,
        signed_url: `/api/storage/${image.image_url}`,
      })),
    }));

    return NextResponse.json({
      success: true,
      scenes: scenesWithUrls,
      pagination: hasPagination ? {
        page,
        limit,
        total: total ?? scenesWithUrls.length,
        totalPages: Math.ceil((total ?? scenesWithUrls.length) / limit),
      } : undefined,
    });
  } catch (error: unknown) {
    console.error('Scene masters fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene masters', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scene-masters
 * シーンマスタを新規作成（画像アップロード含む）
 * lib/db.tsの関数を使用（RLSをバイパス）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string || '';
    const location = formData.get('location') as string || '';
    const timeOfDay = formData.get('time_of_day') as string || '';
    const weather = formData.get('weather') as string || '';
    const mood = formData.get('mood') as string || '';
    const promptHintJa = formData.get('prompt_hint_ja') as string || '';
    const promptHintEn = formData.get('prompt_hint_en') as string || '';
    const tagsJson = formData.get('tags') as string;
    const imageFile = formData.get('image') as File | null;

    // バリデーション
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // タグのパース
    let tags: string[] = [];
    try {
      tags = tagsJson ? JSON.parse(tagsJson) : [];
    } catch {
      return NextResponse.json(
        { error: 'Invalid tags format' },
        { status: 400 }
      );
    }

    let imageUrl: string | undefined;

    // 画像がある場合はアップロード
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

      // ファイルをBase64に変換してアップロード
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      imageUrl = await uploadImageToStorage(
        base64Data,
        imageFile.type,
        imageFile.name,
        'scenes'
      );
    }

    // lib/db.tsの関数を使用（PostgreSQL直接接続、RLSバイパス）
    const scene = await createSceneMaster({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || undefined,
      image_url: imageUrl,
      location: location || undefined,
      time_of_day: timeOfDay || undefined,
      weather: weather || undefined,
      mood: mood || undefined,
      prompt_hint_ja: promptHintJa.trim() || undefined,
      prompt_hint_en: promptHintEn.trim() || undefined,
      tags,
    });

    if (scene.image_url) {
      await createSceneAsset({
        scene_id: scene.id,
        user_id: user.id,
        asset_type: 'image',
        content_url: scene.image_url,
        title: scene.name,
        status: 'selected',
        is_primary: true,
        metadata: { source: 'scene_master_create' },
      });
    }

    return NextResponse.json({
      success: true,
      scene: {
        ...scene,
        signed_url: scene.image_url ? `/api/storage/${scene.image_url}` : undefined,
        scene_assets: scene.image_url ? [{
          id: 0,
          scene_id: scene.id,
          user_id: user.id,
          asset_type: 'image',
          status: 'selected',
          content_url: scene.image_url,
          title: scene.name,
          is_primary: true,
          signed_url: `/api/storage/${scene.image_url}`,
        }] : [],
        scene_images: scene.image_url ? [{
          id: 0,
          scene_id: scene.id,
          user_id: user.id,
          image_url: scene.image_url,
          title: scene.name,
          is_primary: true,
          signed_url: `/api/storage/${scene.image_url}`,
        }] : [],
      },
    });
  } catch (error: unknown) {
    console.error('Scene master creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create scene master', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
