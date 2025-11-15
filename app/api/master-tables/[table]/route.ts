import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMasterRecords,
  createMasterRecord,
  updateMasterRecord,
  deleteMasterRecord,
} from '@/lib/db';

// 許可されたマスタテーブル名のリスト
const ALLOWED_TABLES = [
  'm_camera_angles',
  'm_camera_movements',
  'm_shot_distances',
  'eleven_labs_tags',
];

// テーブル名のバリデーション
function validateTableName(table: string): boolean {
  return ALLOWED_TABLES.includes(table);
}

/**
 * GET /api/master-tables/[table]
 * マスタテーブルのデータ一覧取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;

    if (!validateTableName(table)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    const data = await getAllMasterRecords(table);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Master table fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch master table data', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-tables/[table]
 * マスタテーブルに新規レコード追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;

    if (!validateTableName(table)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, name_ja, description_ja } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const data = await createMasterRecord(table, {
      name: name.trim(),
      description: description?.trim() || '',
      name_ja: name_ja?.trim() || '',
      description_ja: description_ja?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Master table create error:', error);
    return NextResponse.json(
      { error: 'Failed to create master table record', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/master-tables/[table]
 * マスタテーブルのレコード更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;

    if (!validateTableName(table)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { id, name, description, name_ja, description_ja } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const data = await updateMasterRecord(table, id, {
      name: name.trim(),
      description: description?.trim() || '',
      name_ja: name_ja?.trim() || '',
      description_ja: description_ja?.trim() || '',
    });

    if (!data) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Master table update error:', error);
    return NextResponse.json(
      { error: 'Failed to update master table record', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-tables/[table]
 * マスタテーブルのレコード削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;

    if (!validateTableName(table)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const success = await deleteMasterRecord(table, parseInt(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Record deleted successfully',
    });
  } catch (error: any) {
    console.error('Master table delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete master table record', details: error.message },
      { status: 500 }
    );
  }
}
