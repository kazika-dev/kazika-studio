import { NextRequest, NextResponse } from 'next/server';
import { getAllProps, createProp, Prop } from '@/lib/db';
import { uploadImageToStorage, getSignedUrl } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/prop-masters
 * 小物マスタ一覧を取得（署名付きURL付き）
 */
export async function GET(request: NextRequest) {
  try {
    const props = await getAllProps();

    // 各小物に署名付きURLを追加
    const propsWithUrls = await Promise.all(
      props.map(async (prop: Prop) => {
        if (!prop.image_url) {
          return prop;
        }
        try {
          const signedUrl = await getSignedUrl(prop.image_url, 120); // 2時間有効
          return {
            ...prop,
            signed_url: signedUrl,
          };
        } catch (error) {
          console.error('Failed to generate signed URL for prop:', prop.id, error);
          return prop;
        }
      })
    );

    return NextResponse.json({
      success: true,
      props: propsWithUrls,
    });
  } catch (error: any) {
    console.error('Prop masters fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prop masters', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prop-masters
 * 小物マスタを新規作成（画像アップロード含む）
 */
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
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
    const category = formData.get('category') as string || '';
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
        'props'
      );
    }

    // データベースに保存
    const prop = await createProp({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || undefined,
      image_url: imageUrl,
      category: category || undefined,
      prompt_hint_ja: promptHintJa.trim() || undefined,
      prompt_hint_en: promptHintEn.trim() || undefined,
      tags,
    });

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
    console.error('Prop master creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create prop master', details: error.message },
      { status: 500 }
    );
  }
}
