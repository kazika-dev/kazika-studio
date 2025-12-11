import { NextRequest, NextResponse } from 'next/server';
import { getFileFromStorage } from '@/lib/gcp-storage';

/**
 * GET /api/public-storage/[...path]
 * GCP Storage file proxy (no authentication required)
 *
 * Examples:
 * - /api/public-storage/images/output-xxx.png
 * - /api/public-storage/videos/video-xxx.mp4
 * - /api/public-storage/audio/audio-xxx.mp3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Join path segments
    const filePath = pathSegments.join('/');

    // Validation: path is required
    if (!filePath || !filePath.trim()) {
      return NextResponse.json(
        { error: 'path is required' },
        { status: 400 }
      );
    }

    // Path validation (directory traversal attack prevention)
    if (filePath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid path format' },
        { status: 400 }
      );
    }

    // Get file from GCP Storage
    const { data, contentType } = await getFileFromStorage(filePath.trim());

    // Return file as Uint8Array
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': data.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('[api/public-storage] Failed to get file:', error);

    const err = error as { code?: number; message?: string };

    // File not found
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
