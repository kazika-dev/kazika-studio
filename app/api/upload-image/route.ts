import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage } from '@/lib/gcp-storage';

export async function POST(request: NextRequest) {
  try {
    const { base64Data, mimeType, fileName, folder } = await request.json();

    console.log('[upload-image] Upload request received:', {
      mimeType,
      fileName,
      folder,
      base64DataLength: base64Data?.length
    });

    if (!base64Data || !mimeType) {
      return NextResponse.json(
        { error: 'base64Data and mimeType are required' },
        { status: 400 }
      );
    }

    // GCP Storageにアップロード
    const storagePath = await uploadImageToStorage(
      base64Data,
      mimeType,
      fileName,
      folder
    );

    console.log('[upload-image] Upload successful:', { storagePath });

    return NextResponse.json({
      success: true,
      storagePath: storagePath,
    });
  } catch (error: any) {
    console.error('Upload image error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
