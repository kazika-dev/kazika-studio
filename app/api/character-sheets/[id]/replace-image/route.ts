import { NextRequest, NextResponse } from 'next/server';
import { getCharacterSheetById, updateCharacterSheet } from '@/lib/db';
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

/**
 * PUT /api/character-sheets/[id]/replace-image
 * キャラクターシートの画像を差し替える
 */
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

    const characterSheetId = parseInt(params.id);

    if (isNaN(characterSheetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid character sheet ID' },
        { status: 400 }
      );
    }

    // 既存のキャラクターシートを取得
    const existingSheet = await getCharacterSheetById(characterSheetId);

    if (!existingSheet) {
      return NextResponse.json(
        { success: false, error: 'Character sheet not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (existingSheet.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // フォームデータを取得
    const formData = await request.formData();
    const imageFile = formData.get('file') as File;

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
    const { format } = metadata;

    // GCP Storageバケットを取得
    const bucket = getStorage().bucket(process.env.GCP_STORAGE_BUCKET!);

    // 古い画像を削除（GCP Storage）- ストレージパスの場合のみ
    if (existingSheet.image_url && !existingSheet.image_url.startsWith('http')) {
      let oldPath = existingSheet.image_url;
      // /api/storage/ プレフィックスを除去
      if (oldPath.startsWith('/api/storage/')) {
        oldPath = oldPath.replace('/api/storage/', '');
      } else if (oldPath.startsWith('api/storage/')) {
        oldPath = oldPath.replace('api/storage/', '');
      }

      try {
        await bucket.file(oldPath).delete();
        console.log(`Deleted old image: ${oldPath}`);
      } catch (error) {
        console.error('Failed to delete old image from storage:', error);
        // 削除失敗してもエラーにしない（既に削除されている可能性がある）
      }
    }

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const baseName = existingSheet.name.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = format || imageFile.type.split('/')[1] || 'png';
    const fileName = `${baseName}-${timestamp}-${randomStr}.${extension}`;
    const storagePath = `charactersheets/${fileName}`;

    // GCP Storageにアップロード
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType: imageFile.type,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    console.log(`Uploaded new image: ${storagePath}`);

    // データベースを更新
    const updatedSheet = await updateCharacterSheet(characterSheetId, {
      image_url: storagePath,
    });

    return NextResponse.json({
      success: true,
      characterSheet: updatedSheet,
    });
  } catch (error) {
    console.error('Failed to replace character sheet image:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
