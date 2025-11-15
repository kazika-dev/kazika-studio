import { NextRequest, NextResponse } from 'next/server';
import {
  getAllShotDistances,
  createShotDistance,
} from '@/lib/db';

/**
 * GET /api/masters/shot-distances
 * ショット距離一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const distances = await getAllShotDistances();

    return NextResponse.json({
      success: true,
      distances,
    });
  } catch (error: any) {
    console.error('Failed to get shot distances:', error);
    return NextResponse.json(
      { error: 'Failed to get shot distances', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/masters/shot-distances
 * ショット距離を作成
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

    const distance = await createShotDistance({
      name,
      description,
      sort_order,
      is_active,
    });

    return NextResponse.json({
      success: true,
      distance,
    });
  } catch (error: any) {
    console.error('Failed to create shot distance:', error);
    return NextResponse.json(
      { error: 'Failed to create shot distance', details: error.message },
      { status: 500 }
    );
  }
}
