import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCameraAngles,
  createCameraAngle,
} from '@/lib/db';

/**
 * GET /api/masters/camera-angles
 * カメラアングル一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const angles = await getAllCameraAngles();

    return NextResponse.json({
      success: true,
      angles,
    });
  } catch (error: any) {
    console.error('Failed to get camera angles:', error);
    return NextResponse.json(
      { error: 'Failed to get camera angles', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/masters/camera-angles
 * カメラアングルを作成
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

    const angle = await createCameraAngle({
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
    console.error('Failed to create camera angle:', error);
    return NextResponse.json(
      { error: 'Failed to create camera angle', details: error.message },
      { status: 500 }
    );
  }
}
