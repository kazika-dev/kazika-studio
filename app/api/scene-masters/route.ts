import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadImageToStorage, getSignedUrl } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/scene-masters
 * シーンマスタ一覧を取得（署名付きURL付き）
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

    const supabase = await createClient();

    // ユーザーのシーンまたは共有シーンを取得
    const { data: scenes, error } = await supabase
      .from('m_scenes')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Scene masters fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scene masters', details: error.message },
        { status: 500 }
      );
    }

    // 各シーンに署名付きURLを追加
    const scenesWithUrls = await Promise.all(
      (scenes || []).map(async (scene) => {
        if (!scene.image_url) {
          return scene;
        }
        try {
          const signedUrl = await getSignedUrl(scene.image_url, 120); // 2時間有効
          return {
            ...scene,
            signed_url: signedUrl,
          };
        } catch (error) {
          console.error('Failed to generate signed URL for scene:', scene.id, error);
          return scene;
        }
      })
    );

    return NextResponse.json({
      success: true,
      scenes: scenesWithUrls,
    });
  } catch (error: any) {
    console.error('Scene masters fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene masters', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scene-masters
 * シーンマスタを新規作成（画像アップロード含む）
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

    const supabase = await createClient();

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
    } catch (error) {
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

    // データベースに保存
    const { data: scene, error } = await supabase
      .from('m_scenes')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl || null,
        location: location || null,
        time_of_day: timeOfDay || null,
        weather: weather || null,
        mood: mood || null,
        prompt_hint_ja: promptHintJa.trim() || null,
        prompt_hint_en: promptHintEn.trim() || null,
        tags,
      })
      .select()
      .single();

    if (error) {
      console.error('Scene master creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create scene master', details: error.message },
        { status: 500 }
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
    console.error('Scene master creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create scene master', details: error.message },
      { status: 500 }
    );
  }
}
