import { NextRequest, NextResponse } from 'next/server';
import {
  getCameraMovementById,
  updateCameraMovement,
  deleteCameraMovement,
} from '@/lib/db';

/**
 * GET /api/masters/camera-movements/[id]
 * カメラムーブメントを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const movement = await getCameraMovementById(id);

    if (!movement) {
      return NextResponse.json(
        { error: 'Camera movement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      movement,
    });
  } catch (error: any) {
    console.error('Failed to get camera movement:', error);
    return NextResponse.json(
      { error: 'Failed to get camera movement', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/masters/camera-movements/[id]
 * カメラムーブメントを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { name, description, sort_order, is_active } = body;

    const movement = await updateCameraMovement(id, {
      name,
      description,
      sort_order,
      is_active,
    });

    return NextResponse.json({
      success: true,
      movement,
    });
  } catch (error: any) {
    console.error('Failed to update camera movement:', error);
    return NextResponse.json(
      { error: 'Failed to update camera movement', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/masters/camera-movements/[id]
 * カメラムーブメントを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    await deleteCameraMovement(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Failed to delete camera movement:', error);
    return NextResponse.json(
      { error: 'Failed to delete camera movement', details: error.message },
      { status: 500 }
    );
  }
}
