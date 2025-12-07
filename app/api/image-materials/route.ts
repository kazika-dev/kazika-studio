import { NextRequest, NextResponse } from 'next/server';
import {
  getAllImageMaterials,
  createImageMaterial,
} from '@/lib/db';
import {
  uploadImageMaterial,
  getImageMaterialSignedUrl,
} from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import sharp from 'sharp';

/**
 * GET /api/image-materials
 * 画像素材の一覧取得（署名付きURL付き）
 */
export async function GET(request: NextRequest) {
  try {
    const materials = await getAllImageMaterials();

    // 各素材に署名付きURLを追加
    const materialsWithUrls = await Promise.all(
      materials.map(async (material: any) => {
        try {
          const signedUrl = await getImageMaterialSignedUrl(material.file_name, 120); // 2時間有効
          return {
            ...material,
            signed_url: signedUrl,
          };
        } catch (error) {
          console.error('Failed to generate signed URL for:', material.file_name, error);
          return material;
        }
      })
    );

    return NextResponse.json({
      success: true,
      materials: materialsWithUrls,
    });
  } catch (error: any) {
    console.error('Image materials fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image materials', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/image-materials
 * 画像素材の新規作成（ファイルアップロード含む）
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
    const category = formData.get('category') as string;
    const tagsJson = formData.get('tags') as string;
    const imageFile = formData.get('image') as File;

    // バリデーション
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!imageFile) {
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

    // ファイルをBufferに変換
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sharpで画像のメタデータを取得
    let width: number | null = null;
    let height: number | null = null;
    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width || null;
      height = metadata.height || null;
    } catch (error) {
      console.error('Failed to get image metadata:', error);
      // メタデータ取得に失敗してもアップロードは続行
    }

    // GCP Storageにアップロード
    const filePath = await uploadImageMaterial(buffer, imageFile.name, imageFile.type);

    // データベースに保存
    const material = await createImageMaterial({
      name: name.trim(),
      description: description.trim(),
      file_name: filePath,
      width,
      height,
      file_size_bytes: imageFile.size,
      category,
      tags,
    });

    // 署名付きURLを生成
    const signedUrl = await getImageMaterialSignedUrl(filePath, 120);

    return NextResponse.json({
      success: true,
      material: {
        ...material,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Image material creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create image material', details: error.message },
      { status: 500 }
    );
  }
}
