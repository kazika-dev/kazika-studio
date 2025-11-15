import { NextRequest, NextResponse } from 'next/server';
import {
  getCameraAngleById,
  updateCameraAngle,
  deleteCameraAngle,
} from '@/lib/db';

/**
 * GET /api/masters/camera-angles/[id]
 * カメラアングルを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const angle = await getCameraAngleById(id);

    if (!angle) {
      return NextResponse.json(
        { error: 'Camera angle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      angle,
    });
  } catch (error: any) {
    console.error('Failed to get camera angle:', error);
    return NextResponse.json(
      { error: 'Failed to get camera angle', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/masters/camera-angles/[id]
 * カメラアングルを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { name, description, sort_order, is_active } = body;

    const angle = await updateCameraAngle(id, {
      name,
      description,
      sort_order,
      is_active,
    });

    return NextResponse.json({
      success: true,
      angle,
    });
  } catch (error: any) {
    console.error('Failed to update camera angle:', error);
    return NextResponse.json(
      { error: 'Failed to update camera angle', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/masters/camera-angles/[id]
 * カメラアングルを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    await deleteCameraAngle(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Failed to delete camera angle:', error);
    return NextResponse.json(
      { error: 'Failed to delete camera angle', details: error.message },
      { status: 500 }
    );
  }
}
