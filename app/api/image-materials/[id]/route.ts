import { NextRequest, NextResponse } from 'next/server';
import {
  getImageMaterialById,
  updateImageMaterial,
  deleteImageMaterial,
} from '@/lib/db';
import {
  deleteImageMaterial as deleteImageMaterialFromStorage,
  getImageMaterialSignedUrl,
} from '@/lib/gcp-storage';

/**
 * GET /api/image-materials/[id]
 * 画像素材の個別取得（署名付きURL付き）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const materialId = parseInt(id);

    if (isNaN(materialId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const material = await getImageMaterialById(materialId);

    if (!material) {
      return NextResponse.json(
        { error: 'Image material not found' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    const signedUrl = await getImageMaterialSignedUrl(material.file_name, 120);

    return NextResponse.json({
      success: true,
      material: {
        ...material,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Image material fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image material', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/image-materials/[id]
 * 画像素材のメタデータ更新（画像ファイルは変更不可）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const materialId = parseInt(id);

    if (isNaN(materialId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, category, tags } = body;

    // バリデーション
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags must be an array' },
        { status: 400 }
      );
    }

    // データベース更新
    const updatedMaterial = await updateImageMaterial(materialId, {
      name: name.trim(),
      description: description?.trim() || '',
      category,
      tags,
    });

    if (!updatedMaterial) {
      return NextResponse.json(
        { error: 'Image material not found' },
        { status: 404 }
      );
    }

    // 署名付きURLを生成
    const signedUrl = await getImageMaterialSignedUrl(updatedMaterial.file_name, 120);

    return NextResponse.json({
      success: true,
      material: {
        ...updatedMaterial,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Image material update error:', error);
    return NextResponse.json(
      { error: 'Failed to update image material', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/image-materials/[id]
 * 画像素材の削除（データベース + GCP Storage）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const materialId = parseInt(id);

    if (isNaN(materialId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // 削除前に素材情報を取得（file_nameが必要）
    const material = await getImageMaterialById(materialId);

    if (!material) {
      return NextResponse.json(
        { error: 'Image material not found' },
        { status: 404 }
      );
    }

    // データベースから削除
    const deletedMaterial = await deleteImageMaterial(materialId);

    if (!deletedMaterial) {
      return NextResponse.json(
        { error: 'Failed to delete from database' },
        { status: 500 }
      );
    }

    // GCP Storageから削除
    try {
      await deleteImageMaterialFromStorage(material.file_name);
    } catch (error) {
      console.error('Failed to delete from GCP Storage:', error);
      // Storageからの削除に失敗してもデータベースからは削除済みなので警告のみ
    }

    return NextResponse.json({
      success: true,
      message: 'Image material deleted successfully',
    });
  } catch (error: any) {
    console.error('Image material deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image material', details: error.message },
      { status: 500 }
    );
  }
}
