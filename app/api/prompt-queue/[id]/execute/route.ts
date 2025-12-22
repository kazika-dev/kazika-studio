import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getPromptQueueById,
  updatePromptQueue,
  getCharacterSheetById,
  query,
} from '@/lib/db';
import { getApiUrl } from '@/lib/utils/apiUrl';

/**
 * POST /api/prompt-queue/[id]/execute
 * プロンプトキューを実行して画像を生成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const queueId = parseInt(id, 10);

    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queue ID' }, { status: 400 });
    }

    // キューを取得
    const queue = await getPromptQueueById(queueId);

    if (!queue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    // 所有権チェック
    if (queue.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 既に処理中または完了済みの場合はエラー
    if (queue.status === 'processing') {
      return NextResponse.json(
        { error: 'Queue is already processing' },
        { status: 400 }
      );
    }

    if (queue.status === 'completed') {
      return NextResponse.json(
        { error: 'Queue is already completed' },
        { status: 400 }
      );
    }

    // ステータスを processing に更新
    await updatePromptQueue(queueId, { status: 'processing' });

    try {
      // 参照画像を収集
      const referenceImages: { mimeType: string; data: string }[] = [];

      for (const img of queue.images) {
        try {
          let imageUrl: string | null = null;

          if (img.image_type === 'character_sheet') {
            const characterSheet = await getCharacterSheetById(img.reference_id);
            if (characterSheet) {
              imageUrl = characterSheet.image_url;
            }
          } else if (img.image_type === 'output') {
            const outputResult = await query(
              `SELECT content_url FROM kazikastudio.workflow_outputs WHERE id = $1`,
              [img.reference_id]
            );
            if (outputResult.rows.length > 0) {
              imageUrl = outputResult.rows[0].content_url;
            }
          }

          if (imageUrl) {
            // GCP Storage から画像を取得して base64 に変換
            const { getSignedUrl } = await import('@/lib/gcp-storage');
            const signedUrl = await getSignedUrl(imageUrl);

            const imageResponse = await fetch(signedUrl);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const contentType = imageResponse.headers.get('content-type') || 'image/png';

              referenceImages.push({
                mimeType: contentType,
                data: base64,
              });
            }
          }
        } catch (imgError) {
          console.error(`Failed to load image ${img.image_type}:${img.reference_id}:`, imgError);
          // 画像の読み込みに失敗しても続行
        }
      }

      // Nanobana API を呼び出して画像生成
      const nanobanaResponse = await fetch(getApiUrl('/api/nanobana'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: queue.prompt,
          negativePrompt: queue.negative_prompt || '',
          aspectRatio: queue.aspect_ratio || '16:9',
          model: queue.model || 'gemini-2.5-flash-image',
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        }),
      });

      if (!nanobanaResponse.ok) {
        const errorData = await nanobanaResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Nanobana API failed');
      }

      const nanobanaResult = await nanobanaResponse.json();

      // 生成結果を workflow_outputs に保存
      const outputResult = await query(
        `INSERT INTO kazikastudio.workflow_outputs
         (user_id, output_type, content_url, prompt, metadata, source_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, content_url`,
        [
          user.id,
          'image',
          nanobanaResult.storagePath || nanobanaResult.imageUrl,
          queue.prompt,
          JSON.stringify({
            source: 'prompt_queue',
            queue_id: queueId,
            model: queue.model,
            aspect_ratio: queue.aspect_ratio,
            negative_prompt: queue.negative_prompt,
            reference_image_count: referenceImages.length,
          }),
          `/prompt-queue/${queueId}`,
        ]
      );

      const output = outputResult.rows[0];

      // キューを完了に更新
      const updatedQueue = await updatePromptQueue(queueId, {
        status: 'completed',
        output_id: output.id,
        executed_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        queue: updatedQueue,
        output: {
          id: output.id,
          content_url: output.content_url,
        },
      });
    } catch (executeError: any) {
      // 実行に失敗した場合はステータスを failed に更新
      await updatePromptQueue(queueId, {
        status: 'failed',
        error_message: executeError.message,
      });

      throw executeError;
    }
  } catch (error: any) {
    console.error('Failed to execute prompt queue:', error);
    return NextResponse.json(
      { error: 'Failed to execute prompt queue', details: error.message },
      { status: 500 }
    );
  }
}
