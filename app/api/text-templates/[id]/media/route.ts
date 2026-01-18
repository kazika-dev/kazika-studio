import { NextRequest, NextResponse } from 'next/server';
import {
  getTextTemplateById,
  getTextTemplateMediaByTemplateId,
  createTextTemplateMedia,
} from '@/lib/db';
import {
  uploadTextTemplateMedia,
  getTextTemplateMediaSignedUrl,
} from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import sharp from 'sharp';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/text-templates/[id]/media
 * テンプレートのメディア一覧取得（署名付きURL付き）
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // テンプレートの存在確認
    const template = await getTextTemplateById(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // メディア一覧取得
    const mediaList = await getTextTemplateMediaByTemplateId(templateId);

    // 各メディアに署名付きURLを追加
    const mediaWithUrls = await Promise.all(
      mediaList.map(async (media: any) => {
        try {
          const signedUrl = await getTextTemplateMediaSignedUrl(media.file_name, 120);
          return {
            ...media,
            signed_url: signedUrl,
          };
        } catch (error) {
          console.error('Failed to generate signed URL for:', media.file_name, error);
          return media;
        }
      })
    );

    return NextResponse.json({
      success: true,
      media: mediaWithUrls,
    });
  } catch (error: any) {
    console.error('Text template media fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/text-templates/[id]/media
 * メディアファイルアップロード
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // 認証チェック
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // テンプレートの存在と所有権確認
    const template = await getTextTemplateById(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // 自分のテンプレートかどうか確認
    if (template.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only upload media to your own templates' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caption = formData.get('caption') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const validVideoTypes = ['video/mp4', 'video/mov', 'video/quicktime', 'video/webm'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, JPEG, WEBP, GIF (images) or MP4, MOV, WEBM (videos)' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（画像: 10MB, 動画: 100MB）
    const maxSize = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${isImage ? '10MB' : '100MB'} limit` },
        { status: 400 }
      );
    }

    // ファイルをBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 画像のメタデータを取得（画像の場合のみ）
    let width: number | undefined;
    let height: number | undefined;
    if (isImage) {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        console.error('Failed to get image metadata:', error);
      }
    }

    // GCP Storageにアップロード
    const filePath = await uploadTextTemplateMedia(buffer, file.name, file.type, templateId);

    // データベースに保存
    const media = await createTextTemplateMedia({
      template_id: templateId,
      media_type: isImage ? 'image' : 'video',
      file_name: filePath,
      original_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      width,
      height,
      caption: caption.trim() || undefined,
    });

    // 署名付きURLを生成
    const signedUrl = await getTextTemplateMediaSignedUrl(filePath, 120);

    return NextResponse.json({
      success: true,
      media: {
        ...media,
        signed_url: signedUrl,
      },
    });
  } catch (error: any) {
    console.error('Text template media upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media', details: error.message },
      { status: 500 }
    );
  }
}
