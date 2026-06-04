import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { getPool } from '@/lib/db';

type ScriptLineRow = {
  id: number;
  script_id: number;
  line_index: number;
  line_type: string | null;
  speaker_name: string | null;
  text: string | null;
  tts_text: string | null;
  source_conversation_message_id: number | null;
  agent_conversation_message_id: number | null;
  metadata: Record<string, unknown> | null;
};

type DialogueRun = {
  primary: ScriptLineRow;
  lines: ScriptLineRow[];
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getPool().connect();
  try {
    const db = await createKazikaClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const sceneId = Number.parseInt(id, 10);
    if (!Number.isFinite(sceneId)) {
      return NextResponse.json({ success: false, error: 'Invalid scene id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedScriptId = parseOptionalBigInt(body.script_id);
    const mergedAt = new Date().toISOString();

    await client.query('BEGIN');

    const sceneResult = await client.query(
      `
        select ssd.id, st.user_id
        from kazika_studio_agents.story_scenes_domain ssd
        join kazika_studio_agents.stories st on st.id = ssd.story_id
        where ssd.id = $1
          and st.user_id = $2
        limit 1
      `,
      [sceneId, user.id]
    );

    if (!sceneResult.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    const scriptsResult = await client.query(
      `
        select id
        from kazika_studio_agents.scripts
        where agent_story_scene_id = $1
          and ($2::bigint is null or id = $2::bigint)
          and coalesce(status, '') <> 'superseded'
        order by id asc
      `,
      [sceneId, requestedScriptId]
    );

    const scriptIds = scriptsResult.rows.map((row) => Number(row.id));
    if (scriptIds.length === 0) {
      await client.query('COMMIT');
      return NextResponse.json({ success: true, data: { mergedRuns: [], mergedLineIds: [], deletedLineIds: [] } });
    }

    const linesResult = await client.query<ScriptLineRow>(
      `
        select id, script_id, line_index, line_type, speaker_name, text, tts_text, source_conversation_message_id, agent_conversation_message_id, metadata
        from kazika_studio_agents.script_lines
        where script_id = any($1::bigint[])
          and coalesce(metadata->>'deleted', 'false') <> 'true'
          and coalesce(metadata->>'logical_deleted', 'false') <> 'true'
        order by script_id asc, line_index asc, id asc
        for update
      `,
      [scriptIds]
    );

    const runs = findConsecutiveDialogueRuns(linesResult.rows);
    const mergedLineIds: number[] = [];
    const deletedLineIds: number[] = [];

    for (const run of runs) {
      const sourceLineIds = run.lines.map((line) => Number(line.id));
      const sourceLineIndexes = run.lines.map((line) => Number(line.line_index));
      const duplicateLines = run.lines.slice(1);
      const duplicateIds = duplicateLines.map((line) => Number(line.id));
      const mergedText = joinDialogueText(run.lines.map((line) => line.text));
      const mergedTtsText = joinDialogueText(run.lines.map((line) => line.tts_text || line.text));
      const primaryMetadata = run.primary.metadata && typeof run.primary.metadata === 'object' ? run.primary.metadata : {};
      const mergedMetadata = {
        ...primaryMetadata,
        merged_consecutive_dialogue: true,
        merged_at: mergedAt,
        merged_by: user.id,
        merge_policy: 'same_script_consecutive_dialogue_same_speaker',
        merged_source_script_line_ids: sourceLineIds.map(String),
        merged_deleted_script_line_ids: duplicateIds.map(String),
        merged_source_line_indexes: sourceLineIndexes,
      };

      await client.query(
        `
          update kazika_studio_agents.script_lines
          set text = $2,
              tts_text = $3,
              metadata = $4::jsonb,
              updated_at = now()
          where id = $1
        `,
        [run.primary.id, mergedText, mergedTtsText || mergedText, JSON.stringify(mergedMetadata)]
      );

      for (const duplicate of duplicateLines) {
        const duplicateMetadata = duplicate.metadata && typeof duplicate.metadata === 'object' ? duplicate.metadata : {};
        await client.query(
          `
            update kazika_studio_agents.script_lines
            set metadata = $2::jsonb,
                updated_at = now()
            where id = $1
          `,
          [
            duplicate.id,
            JSON.stringify({
              ...duplicateMetadata,
              deleted: true,
              logical_deleted: true,
              merged_into_script_line_id: String(run.primary.id),
              merged_into_dialogue: true,
              merged_at: mergedAt,
              merged_by: user.id,
              merge_policy: 'same_script_consecutive_dialogue_same_speaker',
            }),
          ]
        );
      }

      if (duplicateIds.length > 0) {
        await client.query(
          `
            update kazika_studio_agents.assets
            set script_line_id = $2,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
            where script_line_id = any($1::bigint[])
          `,
          [duplicateIds, run.primary.id, JSON.stringify({ merged_to_script_line_id: String(run.primary.id), merged_at: mergedAt, merged_by: user.id })]
        );

        await client.query(
          `
            update kazika_studio_agents.assets
            set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = now()
            where agent_story_scene_id = $1
              and (
                (metadata->'covered_script_line_ids') ?| $3::text[]
                or (metadata->'audio_group_covered_script_line_ids') ?| $3::text[]
              )
          `,
          [sceneId, JSON.stringify({ merged_to_script_line_id: String(run.primary.id), merged_at: mergedAt, merged_by: user.id }), duplicateIds.map(String)]
        );

        const maxCueResult = await client.query(
          `select coalesce(max(cue_index), 0)::integer as max_cue_index from kazika_studio_agents.script_line_timing_cues where script_line_id = $1`,
          [run.primary.id]
        );
        const cueOffset = Number(maxCueResult.rows[0]?.max_cue_index || 0);
        await client.query(
          `
            update kazika_studio_agents.script_line_timing_cues cue
            set script_line_id = $2,
                cue_index = cue.cue_index + $3
            where cue.script_line_id = any($1::bigint[])
          `,
          [duplicateIds, run.primary.id, cueOffset]
        );

        await client.query(
          `
            update kazika_studio_agents.timeline_clips tc
            set script_line_id = $2,
                metadata = coalesce(tc.metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
            where tc.script_line_id = any($1::bigint[])
          `,
          [duplicateIds, run.primary.id, JSON.stringify({ merged_to_script_line_id: String(run.primary.id), merged_at: mergedAt, merged_by: user.id })]
        );

        const linkedMessageIds = duplicateLines
          .flatMap((line) => [line.agent_conversation_message_id, line.source_conversation_message_id])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        if (linkedMessageIds.length > 0) {
          await client.query(
            `
              update kazika_studio_agents.conversation_messages
              set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
              where id = any($1::bigint[])
            `,
            [Array.from(new Set(linkedMessageIds)), JSON.stringify({ merged_into_script_line_id: String(run.primary.id), merged_at: mergedAt, merged_by: user.id })]
          );
        }
      }

      mergedLineIds.push(run.primary.id);
      deletedLineIds.push(...duplicateIds);
    }

    for (const scriptId of scriptIds) {
      await renumberActiveScriptLines(client, scriptId);
      await updateScriptBodyText(client, scriptId, mergedAt, user.id);
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        mergedRuns: runs.map((run) => ({
          script_id: run.primary.script_id,
          primary_line_id: run.primary.id,
          source_line_ids: run.lines.map((line) => line.id),
          speaker_name: run.primary.speaker_name,
        })),
        mergedLineIds,
        deletedLineIds,
      },
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to merge consecutive dialogue lines:', error);
    const message = error instanceof Error ? error.message : 'Failed to merge consecutive dialogue lines';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

function findConsecutiveDialogueRuns(lines: ScriptLineRow[]) {
  const runs: DialogueRun[] = [];
  let current: ScriptLineRow[] = [];
  let currentKey = '';

  for (const line of lines) {
    const type = String(line.line_type || 'dialogue');
    const speaker = normalizeSpeaker(line.speaker_name);
    const key = `${line.script_id}:${speaker}`;
    if (type === 'dialogue' && speaker) {
      if (current.length > 0 && currentKey === key) {
        current.push(line);
      } else {
        pushRun(runs, current);
        current = [line];
        currentKey = key;
      }
    } else {
      pushRun(runs, current);
      current = [];
      currentKey = '';
    }
  }
  pushRun(runs, current);
  return runs;
}

function pushRun(runs: DialogueRun[], lines: ScriptLineRow[]) {
  if (lines.length > 1) {
    runs.push({ primary: lines[0], lines });
  }
}

function normalizeSpeaker(value: string | null) {
  return String(value || '').trim();
}

function joinDialogueText(values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');
}

function parseOptionalBigInt(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function renumberActiveScriptLines(client: PoolClient, scriptId: number) {
  await client.query(
    `
      update kazika_studio_agents.script_lines
      set line_index = -id,
          updated_at = now()
      where script_id = $1
        and (coalesce(metadata->>'deleted', 'false') = 'true' or coalesce(metadata->>'logical_deleted', 'false') = 'true')
        and line_index <> -id
    `,
    [scriptId]
  );

  await client.query(
    `
      with ordered as (
        select id, row_number() over (order by line_index asc, id asc)::integer as next_line_index
        from kazika_studio_agents.script_lines
        where script_id = $1
          and coalesce(metadata->>'deleted', 'false') <> 'true'
          and coalesce(metadata->>'logical_deleted', 'false') <> 'true'
      )
      update kazika_studio_agents.script_lines sl
      set line_index = 100000 + ordered.next_line_index,
          updated_at = now()
      from ordered
      where sl.id = ordered.id
    `,
    [scriptId]
  );

  await client.query(
    `
      with ordered as (
        select id, row_number() over (order by line_index asc, id asc)::integer as next_line_index
        from kazika_studio_agents.script_lines
        where script_id = $1
          and coalesce(metadata->>'deleted', 'false') <> 'true'
          and coalesce(metadata->>'logical_deleted', 'false') <> 'true'
      )
      update kazika_studio_agents.script_lines sl
      set line_index = ordered.next_line_index,
          updated_at = now()
      from ordered
      where sl.id = ordered.id
    `,
    [scriptId]
  );
}

async function updateScriptBodyText(client: PoolClient, scriptId: number, mergedAt: string, mergedBy: string) {
  const bodyResult = await client.query(
    `
      select string_agg(
        case
          when nullif(speaker_name, '') is null then text
          else speaker_name || ': ' || text
        end,
        E'\n' order by line_index asc, id asc
      ) as body_text,
      count(*)::integer as line_count
      from kazika_studio_agents.script_lines
      where script_id = $1
        and coalesce(metadata->>'deleted', 'false') <> 'true'
        and coalesce(metadata->>'logical_deleted', 'false') <> 'true'
    `,
    [scriptId]
  );

  await client.query(
    `
      update kazika_studio_agents.scripts
      set body_text = $2,
          updated_at = now(),
          metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
      where id = $1
    `,
    [
      scriptId,
      bodyResult.rows[0]?.body_text || '',
      JSON.stringify({
        merged_consecutive_dialogue_at: mergedAt,
        merged_consecutive_dialogue_by: mergedBy,
        active_line_count: bodyResult.rows[0]?.line_count || 0,
      }),
    ]
  );
}
