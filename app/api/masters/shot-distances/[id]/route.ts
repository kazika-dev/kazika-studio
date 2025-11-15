import { NextRequest, NextResponse } from 'next/server';
import {
  getShotDistanceById,
  updateShotDistance,
  deleteShotDistance,
} from '@/lib/db';

/**
 * GET /api/masters/shot-distances/[id]
 * ショット距離を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const distance = await getShotDistanceById(id);

    if (!distance) {
      return NextResponse.json(
        { error: 'Shot distance not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      distance,
    });
  } catch (error: any) {
    console.error('Failed to get shot distance:', error);
    return NextResponse.json(
      { error: 'Failed to get shot distance', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/masters/shot-distances/[id]
 * ショット距離を更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { name, description, sort_order, is_active } = body;

    const distance = await updateShotDistance(id, {
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
    console.error('Failed to update shot distance:', error);
    return NextResponse.json(
      { error: 'Failed to update shot distance', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/masters/shot-distances/[id]
 * ショット距離を削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    await deleteShotDistance(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Failed to delete shot distance:', error);
    return NextResponse.json(
      { error: 'Failed to delete shot distance', details: error.message },
      { status: 500 }
    );
  }
}
