import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSoundEffects,
  getSoundEffectsByCategory,
  createSoundEffect,
} from '@/lib/db';
import { uploadFileToGCS } from '@/lib/storage';

// GET /api/sound-effects - 効果音一覧取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const soundEffects = category
      ? await getSoundEffectsByCategory(category)
      : await getAllSoundEffects();

    return NextResponse.json({
      success: true,
      soundEffects,
    });
  } catch (error) {
    console.error('Error fetching sound effects:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sound effects',
      },
      { status: 500 }
    );
  }
}

// POST /api/sound-effects - 効果音作成（ファイルアップロード）
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const tagsJson = formData.get('tags') as string;
    const audioFile = formData.get('audio') as File;

    if (!name || !audioFile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name and audio file are required',
        },
        { status: 400 }
      );
    }

    const tags = tagsJson ? JSON.parse(tagsJson) : [];

    // ファイルをGCP Storageにアップロード
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const fileName = `audio/sound-effects/${Date.now()}-${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    await uploadFileToGCS(buffer, fileName, audioFile.type);

    // データベースに登録
    const soundEffect = await createSoundEffect({
      name,
      description: description || '',
      file_name: fileName,
      duration_seconds: null, // TODO: 音声ファイルのメタデータから取得
      file_size_bytes: buffer.length,
      category: category || '効果音',
      tags,
    });

    return NextResponse.json({
      success: true,
      soundEffect,
    });
  } catch (error) {
    console.error('Error creating sound effect:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create sound effect',
      },
      { status: 500 }
    );
  }
}
