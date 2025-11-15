import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCameraMovements,
  createCameraMovement,
} from '@/lib/db';

/**
 * GET /api/masters/camera-movements
 * カメラムーブメント一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const movements = await getAllCameraMovements();

    return NextResponse.json({
      success: true,
      movements,
    });
  } catch (error: any) {
    console.error('Failed to get camera movements:', error);
    return NextResponse.json(
      { error: 'Failed to get camera movements', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/masters/camera-movements
 * カメラムーブメントを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, sort_order, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const movement = await createCameraMovement({
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
    console.error('Failed to create camera movement:', error);
    return NextResponse.json(
      { error: 'Failed to create camera movement', details: error.message },
      { status: 500 }
    );
  }
}
