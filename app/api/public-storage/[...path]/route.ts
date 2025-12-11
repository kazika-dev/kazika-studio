import { NextRequest, NextResponse } from 'next/server';
import { getFileFromStorage } from '@/lib/gcp-storage';

/**
 * GET /api/public-storage/[...path]
 * GCP StorageÕ¡¤ë’ô¥ÔY<ûl‹¢¯»¹	
 *
 * ‹:
 * - /api/public-storage/images/output-xxx.png
 * - /api/public-storage/videos/video-xxx.mp4
 * - /api/public-storage/audio/audio-xxx.mp3
 *
 * ì¹İó¹:
 * - Õ¡¤ënĞ¤ÊêÇü¿Content-TypeØM	
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Ñ¹’P
    const filePath = pathSegments.join('/');

    // ĞêÇü·çó: pathoÅ
    if (!filePath || !filePath.trim()) {
      return NextResponse.json(
        { error: 'path is required' },
        { status: 400 }
      );
    }

    // Ñ¹nĞêÇü·çóÇ£ì¯ÈêÈéĞüµë;ƒşV	
    if (filePath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid path format' },
        { status: 400 }
      );
    }

    // GCP StorageK‰Õ¡¤ë’Ö—
    const { data, contentType } = await getFileFromStorage(filePath.trim());

    // Buffer’Uint8Arrayk	ÛWfì¹İó¹’ÔY
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24B“­ãÃ·å
        'Content-Length': data.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('[api/public-storage] Failed to get file:', error);

    const err = error as { code?: number; message?: string };

    // Õ¡¤ëLX(WjD4
    if (err.code === 404 || err.message?.includes('No such object')) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get file', details: err.message },
      { status: 500 }
    );
  }
}
