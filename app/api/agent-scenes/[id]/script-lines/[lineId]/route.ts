import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { query } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const db = await createKazikaClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, lineId } = await params;
    const sceneId = Number.parseInt(id, 10);
    const scriptLineId = Number.parseInt(lineId, 10);
    if (!Number.isFinite(sceneId) || !Number.isFinite(scriptLineId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene or dialogue id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const ttsText = typeof body.tts_text === 'string' ? body.tts_text.trim() : text;
    if (!text) {
      return NextResponse.json({ success: false, error: '会話テキストを入力してください' }, { status: 400 });
    }
    if (text.length > 2000 || ttsText.length > 2000) {
      return NextResponse.json({ success: false, error: '会話テキストが長すぎます' }, { status: 400 });
    }

    const lineResult = await query(
      `
        select
          sl.*,
          sc.id as script_id,
          sc.agent_story_scene_id,
          sc.story_scene_id,
          sc.conversation_id,
          sc.agent_conversation_id,
          st.user_id
        from kazika_studio_agents.script_lines sl
        join kazika_studio_agents.scripts sc on sc.id = sl.script_id
        join kazika_studio_agents.story_scenes_domain ssd
          on ssd.id = sc.agent_story_scene_id
          or ssd.source_story_scene_id = sc.story_scene_id
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ssd.id = $1
          and sl.id = $2
          and st.user_id = $3
        limit 1
      `,
      [sceneId, scriptLineId, user.id]
    );

    const line = lineResult.rows[0];
    if (!line) {
      return NextResponse.json({ success: false, error: 'Dialogue not found' }, { status: 404 });
    }

    const metadataPatch = {
      ...(line.metadata && typeof line.metadata === 'object' ? line.metadata : {}),
      edited_in_agent_scene: true,
      edited_at: new Date().toISOString(),
      edited_by: user.id,
    };

    const updatedLineResult = await query(
      `
        update kazika_studio_agents.script_lines
        set text = $2,
            tts_text = $3,
            metadata = $4::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [scriptLineId, text, ttsText || text, JSON.stringify(metadataPatch)]
    );

    const linkedMessageIds = Array.from(new Set([
      line.agent_conversation_message_id,
      line.source_conversation_message_id,
    ].filter(Boolean).map((value) => Number(value))));

    if (linkedMessageIds.length > 0) {
      await query(
        `
          update kazika_studio_agents.conversation_messages
          set message_text = $2,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where id = any($1::bigint[])
        `,
        [linkedMessageIds, text, JSON.stringify({ edited_from_agent_scene: true, edited_at: new Date().toISOString(), edited_by: user.id })]
      );
    }

    const bodyResult = await query(
      `
        select string_agg(
          case
            when nullif(speaker_name, '') is null then text
            else speaker_name || ': ' || text
          end,
          E'\n' order by line_index asc, id asc
        ) as body_text
        from kazika_studio_agents.script_lines
        where script_id = $1
      `,
      [line.script_id]
    );

    const updatedScriptResult = await query(
      `
        update kazika_studio_agents.scripts
        set body_text = $2,
            updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
        where id = $1
        returning *
      `,
      [line.script_id, bodyResult.rows[0]?.body_text || text, JSON.stringify({ edited_in_agent_scene: true, edited_at: new Date().toISOString(), edited_by: user.id })]
    );

    const conversationIds = Array.from(new Set([
      line.agent_conversation_id,
      line.conversation_id,
    ].filter(Boolean).map((value) => Number(value))));
    if (conversationIds.length > 0) {
      await query(
        `update kazika_studio_agents.conversations set updated_at = now() where id = any($1::bigint[])`,
        [conversationIds]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scriptLine: updatedLineResult.rows[0],
        script: updatedScriptResult.rows[0],
      },
    });
  } catch (error: unknown) {
    console.error('Failed to update agent scene dialogue:', error);
    const message = error instanceof Error ? error.message : 'Failed to update dialogue';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
