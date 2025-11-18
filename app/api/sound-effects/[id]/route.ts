import { NextRequest, NextResponse } from 'next/server';
import {
  getSoundEffectById,
  updateSoundEffect,
  deleteSoundEffect,
} from '@/lib/db';
import { uploadFileToGCS, deleteFileFromGCS } from '@/lib/storage';

// PUT /api/sound-effects/[id] - 効果音更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const soundEffectId = parseInt(id);

    // 既存データを取得
    const existingSoundEffect = await getSoundEffectById(soundEffectId);
    if (!existingSoundEffect) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sound effect not found',
        },
        { status: 404 }
      );
    }

    const contentType = request.headers.get('content-type');
    let updateData: any = {};

    if (contentType?.includes('multipart/form-data')) {
      // ファイルアップロードを含む更新
      const formData = await request.formData();
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const category = formData.get('category') as string;
      const tagsJson = formData.get('tags') as string;
      const audioFile = formData.get('audio') as File | null;

      updateData = {
        name,
        description: description || '',
        category: category || '効果音',
        tags: tagsJson ? JSON.parse(tagsJson) : [],
      };

      // 音声ファイルが提供された場合は置き換える
      if (audioFile) {
        // 既存ファイルを削除
        try {
          await deleteFileFromGCS(existingSoundEffect.file_name);
        } catch (error) {
          console.error('Failed to delete old file:', error);
        }

        // 新しいファイルをアップロード
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        const fileName = `audio/sound-effects/${Date.now()}-${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        await uploadFileToGCS(buffer, fileName, audioFile.type);

        updateData.file_name = fileName;
        updateData.file_size_bytes = buffer.length;
        updateData.duration_seconds = null; // TODO: メタデータから取得
      }
    } else {
      // JSON更新（ファイルなし）
      const body = await request.json();
      updateData = {
        name: body.name,
        description: body.description || '',
        category: body.category || '効果音',
        tags: body.tags || [],
      };
    }

    const updatedSoundEffect = await updateSoundEffect(soundEffectId, updateData);

    return NextResponse.json({
      success: true,
      soundEffect: updatedSoundEffect,
    });
  } catch (error) {
    console.error('Error updating sound effect:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update sound effect',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/sound-effects/[id] - 効果音削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const soundEffectId = parseInt(id);

    // 既存データを取得
    const existingSoundEffect = await getSoundEffectById(soundEffectId);
    if (!existingSoundEffect) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sound effect not found',
        },
        { status: 404 }
      );
    }

    // GCP Storageからファイルを削除
    try {
      await deleteFileFromGCS(existingSoundEffect.file_name);
    } catch (error) {
      console.error('Failed to delete file from GCS:', error);
      // ファイル削除に失敗してもデータベースからは削除する
    }

    // データベースから削除
    await deleteSoundEffect(soundEffectId);

    return NextResponse.json({
      success: true,
      message: 'Sound effect deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting sound effect:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete sound effect',
      },
      { status: 500 }
    );
  }
}
