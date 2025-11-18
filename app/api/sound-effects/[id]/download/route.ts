import { NextRequest, NextResponse } from 'next/server';
import { getSoundEffectById } from '@/lib/db';
import { getFileFromStorage } from '@/lib/gcp-storage';

// GET /api/sound-effects/[id]/download - 音声ファイルダウンロード
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const soundEffectId = parseInt(id);

    const soundEffect = await getSoundEffectById(soundEffectId);

    if (!soundEffect) {
      return NextResponse.json(
        { error: 'Sound effect not found' },
        { status: 404 }
      );
    }

    // GCP Storageからファイルをダウンロード
    const { data: audioBuffer, contentType } = await getFileFromStorage(soundEffect.file_name);

    // 拡張子を取得
    const ext = soundEffect.file_name.split('.').pop()?.toLowerCase() || 'mp3';

    // 音声ファイルを返す
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${soundEffect.name}.${ext}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error downloading sound effect:', error);
    return NextResponse.json(
      { error: 'Failed to download sound effect' },
      { status: 500 }
    );
  }
}
