import { NextRequest, NextResponse } from 'next/server';
import { getSoundEffectById } from '@/lib/db';
import { downloadFileFromGCS } from '@/lib/storage';

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
    const audioBuffer = await downloadFileFromGCS(soundEffect.file_name);

    // MIME typeを推測（拡張子から）
    const ext = soundEffect.file_name.split('.').pop()?.toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      flac: 'audio/flac',
    };
    const mimeType = mimeTypeMap[ext || 'mp3'] || 'audio/mpeg';

    // 音声ファイルを返す
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${soundEffect.name}.${ext || 'mp3'}"`,
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
