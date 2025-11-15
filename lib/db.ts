import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    // Transaction mode pooler用の接続文字列
    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // 開発環境用：SSL証明書の検証を無効化
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // エラーハンドリング
    pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result;
}

export async function getWorkflowById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.workflows WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

// =====================================================
// スタジオ関連の関数
// =====================================================

/**
 * ユーザーの全スタジオを取得
 */
export async function getStudiosByUserId(userId: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.studios WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return result.rows;
}

/**
 * スタジオIDでスタジオを取得
 */
export async function getStudioById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.studios WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * スタジオを作成
 */
export async function createStudio(data: {
  user_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  metadata?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.studios (user_id, name, description, thumbnail_url, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.user_id,
      data.name,
      data.description || '',
      data.thumbnail_url || null,
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * スタジオを更新
 */
export async function updateStudio(id: number, data: {
  name?: string;
  description?: string;
  thumbnail_url?: string;
  metadata?: any;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.thumbnail_url !== undefined) {
    updates.push(`thumbnail_url = $${paramIndex++}`);
    values.push(data.thumbnail_url);
  }
  if (data.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(data.metadata);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.studios SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * スタジオを削除
 */
export async function deleteStudio(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.studios WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0;
}

// =====================================================
// ストーリーボード関連の関数
// =====================================================

/**
 * スタジオの全ボードを取得（時系列順）
 */
export async function getBoardsByStudioId(studioId: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.studio_boards WHERE studio_id = $1 ORDER BY sequence_order ASC',
    [studioId]
  );
  return result.rows;
}

/**
 * ボードIDでボードを取得
 */
export async function getBoardById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.studio_boards WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ボードを作成
 */
export async function createBoard(data: {
  studio_id: number;
  sequence_order: number;
  title?: string;
  description?: string;
  workflow_id?: number;
  prompt_text?: string;
  duration_seconds?: number;
  metadata?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.studio_boards
     (studio_id, sequence_order, title, description, workflow_id, prompt_text, duration_seconds, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.studio_id,
      data.sequence_order,
      data.title || '',
      data.description || '',
      data.workflow_id || null,
      data.prompt_text || '',
      data.duration_seconds || null,
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * ボードを更新
 */
export async function updateBoard(id: number, data: {
  title?: string;
  description?: string;
  workflow_id?: number | null;
  audio_output_id?: number | null;
  image_output_id?: number | null;
  video_output_id?: number | null;
  custom_audio_url?: string | null;
  custom_image_url?: string | null;
  custom_video_url?: string | null;
  prompt_text?: string;
  duration_seconds?: number | null;
  status?: 'draft' | 'processing' | 'completed' | 'error';
  error_message?: string | null;
  metadata?: any;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.workflow_id !== undefined) {
    updates.push(`workflow_id = $${paramIndex++}`);
    values.push(data.workflow_id);
  }
  if (data.audio_output_id !== undefined) {
    updates.push(`audio_output_id = $${paramIndex++}`);
    values.push(data.audio_output_id);
  }
  if (data.image_output_id !== undefined) {
    updates.push(`image_output_id = $${paramIndex++}`);
    values.push(data.image_output_id);
  }
  if (data.video_output_id !== undefined) {
    updates.push(`video_output_id = $${paramIndex++}`);
    values.push(data.video_output_id);
  }
  if (data.custom_audio_url !== undefined) {
    updates.push(`custom_audio_url = $${paramIndex++}`);
    values.push(data.custom_audio_url);
  }
  if (data.custom_image_url !== undefined) {
    updates.push(`custom_image_url = $${paramIndex++}`);
    values.push(data.custom_image_url);
  }
  if (data.custom_video_url !== undefined) {
    updates.push(`custom_video_url = $${paramIndex++}`);
    values.push(data.custom_video_url);
  }
  if (data.prompt_text !== undefined) {
    updates.push(`prompt_text = $${paramIndex++}`);
    values.push(data.prompt_text);
  }
  if (data.duration_seconds !== undefined) {
    updates.push(`duration_seconds = $${paramIndex++}`);
    values.push(data.duration_seconds);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.error_message !== undefined) {
    updates.push(`error_message = $${paramIndex++}`);
    values.push(data.error_message);
  }
  if (data.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(data.metadata);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.studio_boards SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ボードを削除
 */
export async function deleteBoard(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.studio_boards WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0;
}

/**
 * ボードの順序を更新
 * @param studioId スタジオID
 * @param boardIds 新しい順序でのボードIDの配列
 */
export async function reorderBoards(studioId: number, boardIds: number[]) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 各ボードのsequence_orderを更新
    for (let i = 0; i < boardIds.length; i++) {
      await client.query(
        'UPDATE kazikastudio.studio_boards SET sequence_order = $1 WHERE id = $2 AND studio_id = $3',
        [i, boardIds[i], studioId]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// =====================================================
// ボードワークフローステップ関連の関数
// =====================================================

/**
 * ボードの全ステップを取得（順序順）
 * @param boardId ボードID
 * @param includeDetails trueの場合、output_dataとmetadataを含む（デフォルト: false）
 */
export async function getStepsByBoardId(boardId: number, includeDetails: boolean = false) {
  let selectFields;

  if (includeDetails) {
    // 詳細を含む全フィールド
    selectFields = 's.*, w.name as workflow_name, w.description as workflow_description';
  } else {
    // 軽量版：output_dataとmetadataを除外
    selectFields = `
      s.id, s.board_id, s.workflow_id, s.step_order, s.input_config,
      s.execution_status, s.error_message, s.created_at, s.updated_at,
      w.name as workflow_name, w.description as workflow_description
    `;
  }

  const result = await query(
    `SELECT ${selectFields}
     FROM kazikastudio.studio_board_workflow_steps s
     LEFT JOIN kazikastudio.workflows w ON s.workflow_id = w.id
     WHERE s.board_id = $1
     ORDER BY s.step_order ASC`,
    [boardId]
  );
  return result.rows;
}

/**
 * ステップIDでステップを取得
 */
export async function getStepById(id: number) {
  const result = await query(
    `SELECT s.*, w.name as workflow_name
     FROM kazikastudio.studio_board_workflow_steps s
     LEFT JOIN kazikastudio.workflows w ON s.workflow_id = w.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ステップを作成
 */
export async function createStep(data: {
  board_id: number;
  workflow_id: number;
  step_order: number;
  input_config?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.studio_board_workflow_steps
     (board_id, workflow_id, step_order, input_config)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.board_id,
      data.workflow_id,
      data.step_order,
      data.input_config || {},
    ]
  );
  return result.rows[0];
}

/**
 * ステップを更新
 */
export async function updateStep(id: number, data: {
  workflow_id?: number;
  input_config?: any;
  execution_status?: 'pending' | 'running' | 'completed' | 'failed';
  output_data?: any;
  error_message?: string | null;
  metadata?: any;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  console.log('=== updateStep called ===');
  console.log('Step ID:', id);
  console.log('Data to update:', JSON.stringify(data, null, 2));

  if (data.workflow_id !== undefined) {
    updates.push(`workflow_id = $${paramIndex++}`);
    values.push(data.workflow_id);
  }
  if (data.input_config !== undefined) {
    updates.push(`input_config = $${paramIndex++}`);
    values.push(data.input_config);
  }
  if (data.execution_status !== undefined) {
    updates.push(`execution_status = $${paramIndex++}`);
    values.push(data.execution_status);
  }
  if (data.output_data !== undefined) {
    updates.push(`output_data = $${paramIndex++}`);
    values.push(data.output_data);
  }
  if (data.error_message !== undefined) {
    updates.push(`error_message = $${paramIndex++}`);
    values.push(data.error_message);
  }
  if (data.metadata !== undefined) {
    console.log('Metadata is being updated');
    console.log('Metadata value:', JSON.stringify(data.metadata, null, 2));
    updates.push(`metadata = $${paramIndex++}`);
    values.push(data.metadata);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const sql = `UPDATE kazikastudio.studio_board_workflow_steps SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  console.log('SQL:', sql);
  console.log('Values:', values.map((v, i) => `$${i + 1}: ${typeof v === 'object' ? JSON.stringify(v) : v}`));

  const result = await query(sql, values);

  console.log('Update result rows:', result.rows.length);
  if (result.rows.length > 0) {
    console.log('Updated row metadata:', result.rows[0].metadata);
  }

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ステップを削除
 */
export async function deleteStep(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.studio_board_workflow_steps WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0;
}

/**
 * ステップの順序を更新
 * @param boardId ボードID
 * @param stepIds 新しい順序でのステップIDの配列
 */
export async function reorderSteps(boardId: number, stepIds: number[]) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 各ステップのstep_orderを更新
    for (let i = 0; i < stepIds.length; i++) {
      await client.query(
        'UPDATE kazikastudio.studio_board_workflow_steps SET step_order = $1 WHERE id = $2 AND board_id = $3',
        [i, stepIds[i], boardId]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ボードの全ステップをリセット（全てpendingに戻す）
 */
export async function resetBoardSteps(boardId: number) {
  const result = await query(
    `UPDATE kazikastudio.studio_board_workflow_steps
     SET execution_status = 'pending', output_data = NULL, error_message = NULL
     WHERE board_id = $1
     RETURNING *`,
    [boardId]
  );
  return result.rows;
}

// =====================================================
// ワークフロー出力関連の関数
// =====================================================

/**
 * ワークフロー出力を作成
 */
export async function createWorkflowOutput(data: {
  user_id: string;
  workflow_id: number;
  step_id?: number;
  output_type: 'image' | 'video' | 'audio' | 'text' | 'other';
  node_id: string;
  output_url?: string;
  output_data?: any;
  metadata?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.workflow_outputs
     (user_id, workflow_id, step_id, output_type, node_id, output_url, output_data, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.user_id,
      data.workflow_id,
      data.step_id || null,
      data.output_type,
      data.node_id,
      data.output_url || null,
      data.output_data || null,
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * ステップIDでワークフロー出力を取得
 */
export async function getWorkflowOutputsByStepId(stepId: number) {
  const result = await query(
    `SELECT * FROM kazikastudio.workflow_outputs
     WHERE step_id = $1
     ORDER BY created_at ASC`,
    [stepId]
  );
  return result.rows;
}

/**
 * ワークフローIDでワークフロー出力を取得
 */
export async function getWorkflowOutputsByWorkflowId(workflowId: number) {
  const result = await query(
    `SELECT * FROM kazikastudio.workflow_outputs
     WHERE workflow_id = $1
     ORDER BY created_at DESC`,
    [workflowId]
  );
  return result.rows;
}

// =====================================================
// キャラクターシート関連の関数
// =====================================================

/**
 * ユーザーの全キャラクターシートを取得
 */
export async function getCharacterSheetsByUserId(userId: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.character_sheets WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

/**
 * IDでキャラクターシートを取得
 */
export async function getCharacterSheetById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.character_sheets WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * キャラクターシートを作成
 */
export async function createCharacterSheet(data: {
  user_id: string;
  name: string;
  image_url: string;
  description?: string;
  elevenlabs_voice_id?: string;
  metadata?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.character_sheets (user_id, name, image_url, description, elevenlabs_voice_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.user_id,
      data.name,
      data.image_url,
      data.description || '',
      data.elevenlabs_voice_id || null,
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * キャラクターシートを更新
 */
export async function updateCharacterSheet(id: number, data: {
  name?: string;
  image_url?: string;
  description?: string;
  elevenlabs_voice_id?: string;
  metadata?: any;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.image_url !== undefined) {
    updates.push(`image_url = $${paramIndex++}`);
    values.push(data.image_url);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.elevenlabs_voice_id !== undefined) {
    updates.push(`elevenlabs_voice_id = $${paramIndex++}`);
    values.push(data.elevenlabs_voice_id);
  }
  if (data.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(data.metadata);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const sql = `UPDATE kazikastudio.character_sheets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await query(sql, values);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * キャラクターシートを削除
 */
export async function deleteCharacterSheet(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.character_sheets WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0;
}

// =====================================================
// ComfyUI Queue関連の関数
// =====================================================

/**
 * ComfyUIキューアイテムを作成
 */
export async function createComfyUIQueueItem(data: {
  user_id: string;
  comfyui_workflow_name: string;
  workflow_json: any;
  prompt?: string;
  img_gcp_storage_paths?: string[];
  priority?: number;
  metadata?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.comfyui_queues
     (user_id, comfyui_workflow_name, workflow_json, prompt, img_gcp_storage_paths, priority, metadata)
     VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7::jsonb)
     RETURNING *`,
    [
      data.user_id,
      data.comfyui_workflow_name,
      JSON.stringify(data.workflow_json),
      data.prompt || null,
      JSON.stringify(data.img_gcp_storage_paths || []),
      data.priority || 0,
      JSON.stringify(data.metadata || {}),
    ]
  );
  return result.rows[0];
}

/**
 * ComfyUIキューアイテムをIDで取得
 */
export async function getComfyUIQueueItemById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.comfyui_queues WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ユーザーのComfyUIキューアイテムを取得
 */
export async function getComfyUIQueueItemsByUserId(userId: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.comfyui_queues WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

/**
 * 次の処理待ちComfyUIキューアイテムを取得（優先度順）
 */
export async function getNextPendingComfyUIQueueItem() {
  const result = await query(
    `SELECT * FROM kazikastudio.comfyui_queues
     WHERE status = 'pending'
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ComfyUIキューアイテムを更新
 */
export async function updateComfyUIQueueItem(id: number, data: {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  comfyui_prompt_id?: string;
  started_at?: Date;
  completed_at?: Date;
  output_gcp_storage_paths?: string[];
  output_data?: any;
  error_message?: string | null;
  metadata?: any;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.comfyui_prompt_id !== undefined) {
    updates.push(`comfyui_prompt_id = $${paramIndex++}`);
    values.push(data.comfyui_prompt_id);
  }
  if (data.started_at !== undefined) {
    updates.push(`started_at = $${paramIndex++}`);
    values.push(data.started_at);
  }
  if (data.completed_at !== undefined) {
    updates.push(`completed_at = $${paramIndex++}`);
    values.push(data.completed_at);
  }
  if (data.output_gcp_storage_paths !== undefined) {
    updates.push(`output_gcp_storage_paths = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(data.output_gcp_storage_paths));
  }
  if (data.output_data !== undefined) {
    updates.push(`output_data = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(data.output_data));
  }
  if (data.error_message !== undefined) {
    updates.push(`error_message = $${paramIndex++}`);
    values.push(data.error_message);
  }
  if (data.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(data.metadata));
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.comfyui_queues SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ComfyUIキューアイテムを削除
 */
export async function deleteComfyUIQueueItem(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.comfyui_queues WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0;
}

/**
 * ComfyUI prompt_idでキューアイテムを取得
 */
export async function getComfyUIQueueItemByPromptId(promptId: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.comfyui_queues WHERE comfyui_prompt_id = $1',
    [promptId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

// =====================================================
// マスターテーブル関連の関数
// =====================================================

// ----- ElevenLabs Tags -----

export async function getAllElevenLabsTags() {
  const result = await query(
    'SELECT * FROM kazikastudio.eleven_labs_tags WHERE is_active = true ORDER BY sort_order, name'
  );
  return result.rows;
}

export async function getElevenLabsTagById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.eleven_labs_tags WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createElevenLabsTag(data: {
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.eleven_labs_tags (name, description, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.name,
      data.description || '',
      data.sort_order || 0,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );
  return result.rows[0];
}

export async function updateElevenLabsTag(id: number, data: {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${paramIndex++}`);
    values.push(data.sort_order);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }

  if (fields.length === 0) {
    return await getElevenLabsTagById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.eleven_labs_tags SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteElevenLabsTag(id: number) {
  await query('DELETE FROM kazikastudio.eleven_labs_tags WHERE id = $1', [id]);
  return true;
}

// ----- Camera Angles -----

export async function getAllCameraAngles() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_camera_angles WHERE is_active = true ORDER BY sort_order, name'
  );
  return result.rows;
}

export async function getCameraAngleById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_camera_angles WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createCameraAngle(data: {
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.m_camera_angles (name, description, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.name,
      data.description || '',
      data.sort_order || 0,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );
  return result.rows[0];
}

export async function updateCameraAngle(id: number, data: {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${paramIndex++}`);
    values.push(data.sort_order);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }

  if (fields.length === 0) {
    return await getCameraAngleById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.m_camera_angles SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteCameraAngle(id: number) {
  await query('DELETE FROM kazikastudio.m_camera_angles WHERE id = $1', [id]);
  return true;
}

// ----- Camera Movements -----

export async function getAllCameraMovements() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_camera_movements WHERE is_active = true ORDER BY sort_order, name'
  );
  return result.rows;
}

export async function getCameraMovementById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_camera_movements WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createCameraMovement(data: {
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.m_camera_movements (name, description, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.name,
      data.description || '',
      data.sort_order || 0,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );
  return result.rows[0];
}

export async function updateCameraMovement(id: number, data: {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${paramIndex++}`);
    values.push(data.sort_order);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }

  if (fields.length === 0) {
    return await getCameraMovementById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.m_camera_movements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteCameraMovement(id: number) {
  await query('DELETE FROM kazikastudio.m_camera_movements WHERE id = $1', [id]);
  return true;
}

// ----- Shot Distances -----

export async function getAllShotDistances() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_shot_distances WHERE is_active = true ORDER BY sort_order, name'
  );
  return result.rows;
}

export async function getShotDistanceById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_shot_distances WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createShotDistance(data: {
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.m_shot_distances (name, description, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.name,
      data.description || '',
      data.sort_order || 0,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );
  return result.rows[0];
}

export async function updateShotDistance(id: number, data: {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${paramIndex++}`);
    values.push(data.sort_order);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }

  if (fields.length === 0) {
    return await getShotDistanceById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.m_shot_distances SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteShotDistance(id: number) {
  await query('DELETE FROM kazikastudio.m_shot_distances WHERE id = $1', [id]);
  return true;
}
