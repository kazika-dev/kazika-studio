import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage } from '@/lib/gcp-storage';

export async function POST(request: NextRequest) {
  try {
    const { base64Data, mimeType, fileName } = await request.json();

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
      fileName
    );

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
