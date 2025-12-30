import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

// GCP Storage接続を遅延初期化（ビルド時エラー回避）
let storage: Storage | null = null;

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID!,
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL!,
        private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
      },
    });
  }
  return storage;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const id = parseInt(params.id);

    // 既存の素材を取得
    const { data: existingMaterial, error: fetchError } = await supabase
      .from('m_image_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingMaterial) {
      return NextResponse.json(
        { success: false, error: 'Image material not found' },
        { status: 404 }
      );
    }

    // フォームデータを取得
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'No image file provided' },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed.' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（10MB）
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // 画像データをBufferに変換
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sharpで画像メタデータを取得
    const metadata = await sharp(buffer).metadata();
    const { width, height, format } = metadata;

    // GCP Storageバケットを取得
    const bucket = getStorage().bucket(process.env.GCP_STORAGE_BUCKET!);

    // 古い画像を削除（GCP Storage）
    if (existingMaterial.file_name) {
      try {
        await bucket.file(existingMaterial.file_name).delete();
      } catch (error) {
        console.error('Failed to delete old image from storage:', error);
        // 削除失敗してもエラーにしない（既に削除されている可能性がある）
      }
    }

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const baseName = imageFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    const extension = format || imageFile.type.split('/')[1];
    const fileName = `${baseName}-${timestamp}-${randomStr}.${extension}`;
    const storagePath = `materials/${fileName}`;

    // GCP Storageにアップロード
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType: imageFile.type,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // 署名付きURLを生成（2時間有効）
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 2 * 60 * 60 * 1000,
    });

    // データベースを更新
    const { data: updatedMaterial, error: updateError } = await supabase
      .from('m_image_materials')
      .update({
        file_name: storagePath,
        width,
        height,
        file_size_bytes: imageFile.size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update material:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update material' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      material: {
        ...updatedMaterial,
        signed_url: signedUrl,
      },
    });
  } catch (error) {
    console.error('Failed to replace image:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
