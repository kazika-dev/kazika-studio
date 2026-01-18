import { NextRequest, NextResponse } from 'next/server';
import {
  getTextTemplateById,
  getTextTemplateMediaById,
  deleteTextTemplateMediaFromDb,
} from '@/lib/db';
import { deleteTextTemplateMedia } from '@/lib/gcp-storage';
import { authenticateRequest } from '@/lib/auth/apiAuth';

type RouteContext = {
  params: Promise<{ id: string; mediaId: string }>;
};

/**
 * DELETE /api/text-templates/[id]/media/[mediaId]
 * メディアを削除（DB + GCP Storage）
 */
export async function DELETE(
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

    const { id, mediaId } = await context.params;
    const templateId = parseInt(id, 10);
    const mediaIdNum = parseInt(mediaId, 10);

    if (isNaN(templateId) || isNaN(mediaIdNum)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
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
        { error: 'You can only delete media from your own templates' },
        { status: 403 }
      );
    }

    // メディアの存在確認
    const media = await getTextTemplateMediaById(mediaIdNum);
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    // メディアがこのテンプレートに属しているか確認
    if (media.template_id !== templateId) {
      return NextResponse.json(
        { error: 'Media does not belong to this template' },
        { status: 400 }
      );
    }

    // GCP Storageから削除
    try {
      await deleteTextTemplateMedia(media.file_name);
    } catch (error) {
      console.error('Failed to delete file from storage:', error);
      // ストレージの削除に失敗してもDBからは削除を続行
    }

    // データベースから削除
    await deleteTextTemplateMediaFromDb(mediaIdNum);

    return NextResponse.json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error: any) {
    console.error('Text template media delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete media', details: error.message },
      { status: 500 }
    );
  }
}
