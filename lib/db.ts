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
 *
 * NOTE: This function uses the production schema with content_url instead of output_url.
 * step_id and node_id are stored in metadata for backward compatibility.
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
  // Merge step_id and node_id into metadata for backward compatibility
  const enrichedMetadata = {
    ...(data.metadata || {}),
    step_id: data.step_id,
    node_id: data.node_id,
  };

  const result = await query(
    `INSERT INTO kazikastudio.workflow_outputs
     (user_id, workflow_id, output_type, content_url, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.user_id,
      data.workflow_id,
      data.output_type,
      data.output_url || null,
      enrichedMetadata,
    ]
  );
  return result.rows[0];
}

/**
 * ステップIDでワークフロー出力を取得
 *
 * NOTE: step_id is stored in metadata for backward compatibility with production schema
 */
export async function getWorkflowOutputsByStepId(stepId: number) {
  const result = await query(
    `SELECT * FROM kazikastudio.workflow_outputs
     WHERE metadata->>'step_id' = $1
     ORDER BY created_at ASC`,
    [stepId.toString()]
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

/**
 * IDでworkflow outputを1つ取得
 */
export async function getWorkflowOutputById(id: number) {
  const result = await query(
    `SELECT * FROM kazikastudio.workflow_outputs
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// =====================================================
// キャラクターシート関連の関数
// =====================================================

/**
 * ユーザーの全キャラクターシートを取得
 * @param userId ユーザーID
 * @param limit 取得件数（省略時は全件）
 * @param offset 開始位置（省略時は0）
 */
export async function getCharacterSheetsByUserId(userId: string, limit?: number, offset?: number) {
  // お気に入り優先 → 作成日時降順でソート
  let sql = 'SELECT * FROM kazikastudio.character_sheets WHERE user_id = $1 ORDER BY is_favorite DESC, created_at DESC';
  const params: any[] = [userId];

  if (limit !== undefined && limit > 0) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }
  if (offset !== undefined && offset > 0) {
    sql += ` OFFSET $${params.length + 1}`;
    params.push(offset);
  }

  const result = await query(sql, params);
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
  is_favorite?: boolean;
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
  if (data.is_favorite !== undefined) {
    updates.push(`is_favorite = $${paramIndex++}`);
    values.push(data.is_favorite);
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
// マスターテーブル汎用関数
// =====================================================

/**
 * マスターテーブルの全レコードを取得
 */
export async function getAllMasterRecords(tableName: string) {
  const result = await query(
    `SELECT * FROM kazikastudio.${tableName} ORDER BY id ASC`,
    []
  );
  return result.rows;
}

/**
 * マスターテーブルのレコードをIDで取得
 */
export async function getMasterRecordById(tableName: string, id: number) {
  const result = await query(
    `SELECT * FROM kazikastudio.${tableName} WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * マスターテーブルにレコードを作成
 */
export async function createMasterRecord(tableName: string, data: any) {
  // m_text_templates テーブルの特別な処理
  if (tableName === 'm_text_templates') {
    const result = await query(
      `INSERT INTO kazikastudio.${tableName}
       (name, name_ja, content, description, description_ja, category, tags, is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.name,
        data.name_ja || '',
        data.content,
        data.description || '',
        data.description_ja || '',
        data.category || 'general',
        data.tags || [],
        data.is_active !== undefined ? data.is_active : true,
        data.user_id, // API route から渡される
      ]
    );
    return result.rows[0];
  }

  // 既存のマスタテーブル用の処理
  const result = await query(
    `INSERT INTO kazikastudio.${tableName} (name, description, name_ja, description_ja)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.name,
      data.description || '',
      data.name_ja || '',
      data.description_ja || '',
    ]
  );
  return result.rows[0];
}

/**
 * マスターテーブルのレコードを更新
 */
export async function updateMasterRecord(tableName: string, id: number, data: any) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // m_text_templates テーブルの特別な処理
  if (tableName === 'm_text_templates') {
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.name_ja !== undefined) {
      updates.push(`name_ja = $${paramIndex++}`);
      values.push(data.name_ja);
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.description_ja !== undefined) {
      updates.push(`description_ja = $${paramIndex++}`);
      values.push(data.description_ja);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }
    updates.push(`updated_at = NOW()`);
  } else {
    // 既存のマスタテーブル用の処理
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.name_ja !== undefined) {
      updates.push(`name_ja = $${paramIndex++}`);
      values.push(data.name_ja);
    }
    if (data.description_ja !== undefined) {
      updates.push(`description_ja = $${paramIndex++}`);
      values.push(data.description_ja);
    }
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const sql = `UPDATE kazikastudio.${tableName} SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await query(sql, values);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * マスターテーブルのレコードを削除
 */
export async function deleteMasterRecord(tableName: string, id: number) {
  const result = await query(
    `DELETE FROM kazikastudio.${tableName} WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows.length > 0;
}

// =====================================================
// ElevenLabs Tags関連の関数
// =====================================================

/**
 * 全てのElevenLabsタグを取得
 */
export async function getAllElevenLabsTags() {
  const result = await query(
    'SELECT * FROM kazikastudio.eleven_labs_tags ORDER BY created_at DESC',
    []
  );
  return result.rows;
}

/**
 * IDでElevenLabsタグを取得
 */
export async function getElevenLabsTagById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.eleven_labs_tags WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ElevenLabsタグを作成
 */
export async function createElevenLabsTag(data: {
  name: string;
  description?: string;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.eleven_labs_tags (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [
      data.name,
      data.description || '',
    ]
  );
  return result.rows[0];
}

/**
 * ElevenLabsタグを更新
 */
export async function updateElevenLabsTag(id: number, data: {
  name?: string;
  description?: string;
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

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const sql = `UPDATE kazikastudio.eleven_labs_tags SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await query(sql, values);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * ElevenLabsタグを削除
 */
export async function deleteElevenLabsTag(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.eleven_labs_tags WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0;
}

// =====================================================
// Camera Angles / Shot Distances関連の関数
// =====================================================

/**
 * 全てのカメラアングルを取得
 */
export async function getAllCameraAngles() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_camera_angles ORDER BY id ASC',
    []
  );
  return result.rows;
}

/**
 * 全てのショット距離を取得
 */
export async function getAllShotDistances() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_shot_distances ORDER BY id ASC',
    []
  );
  return result.rows;
}

/**
 * ランダムにカメラアングルを1つ取得
 */
export async function getRandomCameraAngle() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_camera_angles ORDER BY RANDOM() LIMIT 1',
    []
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * ランダムにショット距離を1つ取得
 */
export async function getRandomShotDistance() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_shot_distances ORDER BY RANDOM() LIMIT 1',
    []
  );
  return result.rows.length > 0 ? result.rows[0] : null;
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
// 効果音マスター関連の関数
// =====================================================

/**
 * 全ての効果音を取得
 */
export async function getAllSoundEffects() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects ORDER BY category ASC, name ASC',
    []
  );
  return result.rows;
}

/**
 * 効果音をIDで取得
 */
export async function getSoundEffectById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 効果音をファイル名で取得
 */
export async function getSoundEffectByFileName(fileName: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects WHERE file_name = $1',
    [fileName]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * カテゴリで効果音を検索
 */
export async function getSoundEffectsByCategory(category: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects WHERE category = $1 ORDER BY name ASC',
    [category]
  );
  return result.rows;
}

/**
 * タグで効果音を検索
 */
export async function getSoundEffectsByTag(tag: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects WHERE $1 = ANY(tags) ORDER BY name ASC',
    [tag]
  );
  return result.rows;
}

/**
 * 効果音を作成
 */
export async function createSoundEffect(data: {
  name: string;
  description?: string;
  file_name: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  category?: string;
  tags?: string[];
}) {
  const result = await query(
    `INSERT INTO kazikastudio.m_sound_effects
     (name, description, file_name, duration_seconds, file_size_bytes, category, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.description || '',
      data.file_name,
      data.duration_seconds || null,
      data.file_size_bytes || null,
      data.category || '',
      data.tags || [],
    ]
  );
  return result.rows[0];
}

/**
 * 効果音を更新
 */
export async function updateSoundEffect(
  id: number,
  data: {
    name?: string;
    description?: string;
    file_name?: string;
    duration_seconds?: number;
    file_size_bytes?: number;
    category?: string;
    tags?: string[];
  }
) {
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
  if (data.file_name !== undefined) {
    fields.push(`file_name = $${paramIndex++}`);
    values.push(data.file_name);
  }
  if (data.duration_seconds !== undefined) {
    fields.push(`duration_seconds = $${paramIndex++}`);
    values.push(data.duration_seconds);
  }
  if (data.file_size_bytes !== undefined) {
    fields.push(`file_size_bytes = $${paramIndex++}`);
    values.push(data.file_size_bytes);
  }
  if (data.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }
  if (data.tags !== undefined) {
    fields.push(`tags = $${paramIndex++}`);
    values.push(data.tags);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);
  const result = await query(
    `UPDATE kazikastudio.m_sound_effects
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 効果音を削除
 */
export async function deleteSoundEffect(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.m_sound_effects WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * ランダムに効果音を1つ取得
 */
export async function getRandomSoundEffect() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects ORDER BY RANDOM() LIMIT 1',
    []
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * カテゴリからランダムに効果音を取得
 */
export async function getRandomSoundEffectByCategory(category: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_sound_effects WHERE category = $1 ORDER BY RANDOM() LIMIT 1',
    [category]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// =====================================================
// ストーリー・シーン関連の関数
// =====================================================

/**
 * ユーザーの全ストーリーを取得
 */
export async function getStoriesByUserId(userId: string) {
  const result = await query(
    'SELECT * FROM kazikastudio.stories WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return result.rows;
}

/**
 * ストーリーIDでストーリーを取得
 */
export async function getStoryById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.stories WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * ストーリーを作成
 */
export async function createStory(data: {
  user_id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  metadata?: any;
}) {
  const result = await query(
    `INSERT INTO kazikastudio.stories (user_id, title, description, thumbnail_url, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.user_id,
      data.title,
      data.description || null,
      data.thumbnail_url || null,
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * ストーリーを更新
 */
export async function updateStory(id: number, data: {
  title?: string;
  description?: string;
  thumbnail_url?: string;
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
    `UPDATE kazikastudio.stories
     SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * ストーリーを削除
 */
export async function deleteStory(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.stories WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

/**
 * ストーリーIDでシーンを取得
 */
export async function getScenesByStoryId(storyId: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.story_scenes WHERE story_id = $1 ORDER BY sequence_order ASC',
    [storyId]
  );
  return result.rows;
}

/**
 * シーンIDでシーンを取得
 */
export async function getSceneById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.story_scenes WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * シーンを作成
 */
export async function createStoryScene(data: {
  story_id: number;
  title: string;
  description?: string;
  sequence_order?: number;
  metadata?: any;
}) {
  // sequence_orderが指定されていない場合は、最後に追加
  let sequenceOrder = data.sequence_order;
  if (sequenceOrder === undefined) {
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(sequence_order), 0) as max_order FROM kazikastudio.story_scenes WHERE story_id = $1',
      [data.story_id]
    );
    sequenceOrder = (maxOrderResult.rows[0].max_order || 0) + 1;
  }

  const result = await query(
    `INSERT INTO kazikastudio.story_scenes (story_id, title, description, sequence_order, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.story_id,
      data.title,
      data.description || null,
      sequenceOrder,
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * シーンを更新
 */
export async function updateStoryScene(id: number, data: {
  title?: string;
  description?: string;
  sequence_order?: number;
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
  if (data.sequence_order !== undefined) {
    updates.push(`sequence_order = $${paramIndex++}`);
    values.push(data.sequence_order);
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
    `UPDATE kazikastudio.story_scenes
     SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * シーンを削除
 */
export async function deleteStoryScene(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.story_scenes WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

/**
 * シーンIDで会話を取得
 */
export async function getConversationsBySceneId(sceneId: number) {
  const result = await query(
    `SELECT c.*,
            COUNT(DISTINCT cm.id) as message_count
     FROM kazikastudio.conversations c
     LEFT JOIN kazikastudio.conversation_messages cm ON cm.conversation_id = c.id
     WHERE c.story_scene_id = $1
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
    [sceneId]
  );
  return result.rows;
}

/**
 * ユーザーの全ストーリーとシーン・会話の階層構造を取得
 */
export async function getStoriesTreeByUserId(userId: string) {
  // 全ストーリーを取得
  const stories = await getStoriesByUserId(userId);

  const tree = await Promise.all(
    stories.map(async (story) => {
      // ストーリーごとのシーンを取得
      const scenes = await getScenesByStoryId(story.id);

      // 各シーンの会話を取得
      const scenesWithConversations = await Promise.all(
        scenes.map(async (scene) => {
          const conversations = await getConversationsBySceneId(scene.id);
          return {
            scene,
            conversations,
          };
        })
      );

      return {
        story,
        scenes: scenesWithConversations,
      };
    })
  );

  return tree;
}

// =====================================================
// 画像素材マスタ関連の関数
// =====================================================

/**
 * 全ての画像素材を取得
 */
export async function getAllImageMaterials() {
  const result = await query(
    'SELECT * FROM kazikastudio.m_image_materials ORDER BY created_at DESC',
    []
  );
  return result.rows;
}

/**
 * IDで画像素材を取得
 */
export async function getImageMaterialById(id: number) {
  const result = await query(
    'SELECT * FROM kazikastudio.m_image_materials WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * 画像素材を作成
 */
export async function createImageMaterial(data: {
  name: string;
  description: string;
  file_name: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  category: string;
  tags: string[];
}) {
  const result = await query(
    `INSERT INTO kazikastudio.m_image_materials
      (name, description, file_name, width, height, file_size_bytes, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
    [
      data.name,
      data.description,
      data.file_name,
      data.width,
      data.height,
      data.file_size_bytes,
      data.category,
      data.tags,
    ]
  );

  return result.rows[0];
}

/**
 * 画像素材を更新
 */
export async function updateImageMaterial(
  id: number,
  data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
  }
) {
  const result = await query(
    `UPDATE kazikastudio.m_image_materials
      SET name = $1, description = $2, category = $3, tags = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *`,
    [data.name, data.description, data.category, data.tags, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * 画像素材を削除
 */
export async function deleteImageMaterial(id: number) {
  const result = await query(
    'DELETE FROM kazikastudio.m_image_materials WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// ==========================================
// Conversation Message Characters Functions
// ==========================================

/**
 * メッセージに紐づくキャラクター一覧を取得
 */
export async function getMessageCharacters(messageId: number) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
      cmc.id,
      cmc.conversation_message_id,
      cmc.character_sheet_id,
      cmc.display_order,
      cmc.created_at,
      cmc.metadata,
      cs.id as character_id,
      cs.name as character_name,
      cs.image_url as character_image_url,
      cs.description as character_description,
      cs.personality as character_personality,
      cs.speaking_style as character_speaking_style
    FROM kazikastudio.conversation_message_characters cmc
    JOIN kazikastudio.character_sheets cs ON cs.id = cmc.character_sheet_id
    WHERE cmc.conversation_message_id = $1
    ORDER BY cmc.display_order ASC`,
    [messageId]
  );

  return result.rows.map(row => ({
    id: row.id,
    conversation_message_id: row.conversation_message_id,
    character_sheet_id: row.character_sheet_id,
    display_order: row.display_order,
    created_at: row.created_at,
    metadata: row.metadata,
    character_sheets: {
      id: row.character_id,
      name: row.character_name,
      image_url: row.character_image_url,
      description: row.character_description,
      personality: row.character_personality,
      speaking_style: row.character_speaking_style
    }
  }));
}

/**
 * メッセージにキャラクターを追加
 */
export async function addCharacterToMessage(
  messageId: number,
  characterId: number,
  options?: { displayOrder?: number }
) {
  const pool = getPool();

  // Get current max display_order if not provided
  let displayOrder = options?.displayOrder;
  if (displayOrder === undefined) {
    const maxResult = await pool.query(
      `SELECT COALESCE(MAX(display_order), 0) as max_order
       FROM kazikastudio.conversation_message_characters
       WHERE conversation_message_id = $1`,
      [messageId]
    );
    displayOrder = (maxResult.rows[0]?.max_order || 0) + 1;
  }

  const result = await pool.query(
    `INSERT INTO kazikastudio.conversation_message_characters
      (conversation_message_id, character_sheet_id, display_order)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_message_id, character_sheet_id)
     DO UPDATE SET display_order = EXCLUDED.display_order
     RETURNING *`,
    [messageId, characterId, displayOrder]
  );

  return result.rows[0];
}

/**
 * メッセージからキャラクターを削除
 */
export async function removeCharacterFromMessage(
  messageId: number,
  characterId: number
) {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM kazikastudio.conversation_message_characters
     WHERE conversation_message_id = $1 AND character_sheet_id = $2
     RETURNING *`,
    [messageId, characterId]
  );

  return result.rows[0];
}

/**
 * メッセージ内のキャラクター表示順序を更新
 */
export async function updateMessageCharacterOrder(
  messageId: number,
  characterOrders: Array<{ characterId: number; displayOrder: number }>
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const { characterId, displayOrder } of characterOrders) {
      await client.query(
        `UPDATE kazikastudio.conversation_message_characters
         SET display_order = $3
         WHERE conversation_message_id = $1 AND character_sheet_id = $2`,
        [messageId, characterId, displayOrder]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// Conversation Prompt Templates
// ============================================================================

/**
 * Get all conversation prompt templates for a user (or global templates if userId is null)
 */
export async function getConversationPromptTemplates(userId?: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM kazikastudio.conversation_prompt_templates
     WHERE user_id = $1 OR user_id IS NULL
     ORDER BY is_default DESC, created_at DESC`,
    [userId || null]
  );
  return result.rows;
}

/**
 * Get a single conversation prompt template by ID
 */
export async function getConversationPromptTemplateById(id: number) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM kazikastudio.conversation_prompt_templates WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get the default conversation prompt template
 */
export async function getDefaultConversationPromptTemplate() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM kazikastudio.conversation_prompt_templates
     WHERE is_default = true
     ORDER BY created_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Create a new conversation prompt template
 */
export async function createConversationPromptTemplate(
  userId: string,
  name: string,
  templateText: string,
  description?: string,
  isDefault?: boolean
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // If creating a new default template, clear all other defaults first
    if (isDefault === true) {
      await client.query(
        `UPDATE kazikastudio.conversation_prompt_templates
         SET is_default = false`
      );
    }

    const result = await client.query(
      `INSERT INTO kazikastudio.conversation_prompt_templates
       (user_id, name, description, template_text, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, description || null, templateText, isDefault || false]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a conversation prompt template
 */
export async function updateConversationPromptTemplate(
  id: number,
  updates: {
    name?: string;
    description?: string;
    templateText?: string;
    isDefault?: boolean;
  }
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // If setting this template as default, clear all other defaults first
    if (updates.isDefault === true) {
      await client.query(
        `UPDATE kazikastudio.conversation_prompt_templates
         SET is_default = false
         WHERE id != $1`,
        [id]
      );
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.templateText !== undefined) {
      setClauses.push(`template_text = $${paramIndex++}`);
      values.push(updates.templateText);
    }
    if (updates.isDefault !== undefined) {
      setClauses.push(`is_default = $${paramIndex++}`);
      values.push(updates.isDefault);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE kazikastudio.conversation_prompt_templates
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a conversation prompt template
 */
export async function deleteConversationPromptTemplate(id: number) {
  const pool = getPool();
  await pool.query(
    `DELETE FROM kazikastudio.conversation_prompt_templates WHERE id = $1`,
    [id]
  );
}

// ============================================================================
// Prompt Queue
// ============================================================================

import type {
  PromptQueue,
  PromptQueueWithImages,
  PromptQueueImageWithDetails,
  PromptQueueStatus,
  PromptQueueImageType,
  PromptEnhanceMode,
} from '@/types/prompt-queue';

/**
 * ユーザーのプロンプトキュー一覧を取得（参照画像付き）
 */
export async function getPromptQueuesByUserId(
  userId: string,
  options?: {
    status?: PromptQueueStatus;
    hasSplitSource?: boolean;  // true: source_output_idがあるものだけ、false: ないものだけ
    limit?: number;
    offset?: number;
  }
): Promise<{ queues: PromptQueueWithImages[]; total: number }> {
  const { status, hasSplitSource, limit = 50, offset = 0 } = options || {};

  // 件数取得
  let countQuery = `SELECT COUNT(*) as count FROM kazikastudio.prompt_queues WHERE user_id = $1`;
  const countParams: any[] = [userId];
  let countParamIndex = 2;

  if (status) {
    countQuery += ` AND status = $${countParamIndex++}`;
    countParams.push(status);
  }

  if (hasSplitSource === true) {
    countQuery += ` AND source_output_id IS NOT NULL`;
  } else if (hasSplitSource === false) {
    countQuery += ` AND source_output_id IS NULL`;
  }

  const countResult = await query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);

  // キュー取得（source_output_idがある場合はその画像URLも取得）
  let queuesQuery = `
    SELECT pq.*, wo.content_url as source_output_url
    FROM kazikastudio.prompt_queues pq
    LEFT JOIN kazikastudio.workflow_outputs wo ON pq.source_output_id = wo.id
    WHERE pq.user_id = $1
  `;
  const queuesParams: any[] = [userId];
  let paramIndex = 2;

  if (status) {
    queuesQuery += ` AND pq.status = $${paramIndex++}`;
    queuesParams.push(status);
  }

  if (hasSplitSource === true) {
    queuesQuery += ` AND pq.source_output_id IS NOT NULL`;
  } else if (hasSplitSource === false) {
    queuesQuery += ` AND pq.source_output_id IS NULL`;
  }

  queuesQuery += ` ORDER BY pq.priority DESC, pq.created_at ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  queuesParams.push(limit, offset);

  const queuesResult = await query(queuesQuery, queuesParams);
  const queues = queuesResult.rows as (PromptQueue & { source_output_url?: string | null })[];

  // 各キューの参照画像を取得
  const queuesWithImages: PromptQueueWithImages[] = await Promise.all(
    queues.map(async (q) => {
      const images = await getPromptQueueImages(q.id);
      return {
        ...q,
        images,
        image_count: images.length,
      };
    })
  );

  return { queues: queuesWithImages, total };
}

/**
 * プロンプトキューをIDで取得（参照画像付き）
 */
export async function getPromptQueueById(id: number): Promise<PromptQueueWithImages | null> {
  const result = await query(
    `SELECT * FROM kazikastudio.prompt_queues WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const queue = result.rows[0] as PromptQueue;
  const images = await getPromptQueueImages(id);

  return {
    ...queue,
    images,
    image_count: images.length,
  };
}

/**
 * プロンプトキューの参照画像を取得（詳細情報付き）
 * 対応する画像タイプ: character_sheet, output, scene, prop
 */
export async function getPromptQueueImages(queueId: number): Promise<PromptQueueImageWithDetails[]> {
  const result = await query(
    `SELECT
       pqi.id,
       pqi.queue_id,
       pqi.image_type,
       pqi.reference_id,
       pqi.display_order,
       pqi.created_at,
       CASE
         WHEN pqi.image_type = 'character_sheet' THEN cs.image_url
         WHEN pqi.image_type = 'output' THEN wo.content_url
         WHEN pqi.image_type = 'scene' THEN sc.image_url
         WHEN pqi.image_type = 'prop' THEN pr.image_url
       END as image_url,
       CASE
         WHEN pqi.image_type = 'character_sheet' THEN cs.name
         WHEN pqi.image_type = 'scene' THEN sc.name
         WHEN pqi.image_type = 'prop' THEN pr.name
         ELSE NULL
       END as name
     FROM kazikastudio.prompt_queue_images pqi
     LEFT JOIN kazikastudio.character_sheets cs
       ON pqi.image_type = 'character_sheet' AND pqi.reference_id = cs.id
     LEFT JOIN kazikastudio.workflow_outputs wo
       ON pqi.image_type = 'output' AND pqi.reference_id = wo.id
     LEFT JOIN kazikastudio.m_scenes sc
       ON pqi.image_type = 'scene' AND pqi.reference_id = sc.id
     LEFT JOIN kazikastudio.m_props pr
       ON pqi.image_type = 'prop' AND pqi.reference_id = pr.id
     WHERE pqi.queue_id = $1
     ORDER BY pqi.display_order ASC`,
    [queueId]
  );

  return result.rows as PromptQueueImageWithDetails[];
}

/**
 * プロンプトキューを作成
 */
export async function createPromptQueue(
  userId: string,
  data: {
    name?: string;
    prompt: string;
    negative_prompt?: string;
    model?: string;
    aspect_ratio?: string;
    priority?: number;
    enhance_prompt?: PromptEnhanceMode;
    enhanced_prompt?: string | null;
    source_output_id?: number;
    metadata?: Record<string, any>;
    images?: { image_type: PromptQueueImageType; reference_id: number }[];
  }
): Promise<PromptQueueWithImages> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // キューを作成
    const queueResult = await client.query(
      `INSERT INTO kazikastudio.prompt_queues
       (user_id, name, prompt, negative_prompt, model, aspect_ratio, priority, enhance_prompt, enhanced_prompt, source_output_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        data.name || null,
        data.prompt,
        data.negative_prompt || null,
        data.model || 'gemini-2.5-flash-image',
        data.aspect_ratio || '16:9',
        data.priority || 0,
        data.enhance_prompt || 'none',
        data.enhanced_prompt || null,
        data.source_output_id || null,
        JSON.stringify(data.metadata || {}),
      ]
    );

    const queue = queueResult.rows[0] as PromptQueue;

    // 参照画像を追加
    if (data.images && data.images.length > 0) {
      for (let i = 0; i < Math.min(data.images.length, 8); i++) {
        const img = data.images[i];
        await client.query(
          `INSERT INTO kazikastudio.prompt_queue_images
           (queue_id, image_type, reference_id, display_order)
           VALUES ($1, $2, $3, $4)`,
          [queue.id, img.image_type, img.reference_id, i]
        );
      }
    }

    await client.query('COMMIT');

    // 参照画像付きで返す
    const images = await getPromptQueueImages(queue.id);
    return {
      ...queue,
      images,
      image_count: images.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * プロンプトキューを更新
 */
export async function updatePromptQueue(
  id: number,
  data: {
    name?: string;
    prompt?: string;
    negative_prompt?: string;
    model?: string;
    aspect_ratio?: string;
    priority?: number;
    status?: PromptQueueStatus;
    enhance_prompt?: PromptEnhanceMode;
    enhanced_prompt?: string | null;
    metadata?: Record<string, any>;
    error_message?: string;
    output_id?: number;
    executed_at?: string;
    images?: { image_type: PromptQueueImageType; reference_id: number }[];
  }
): Promise<PromptQueueWithImages | null> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 動的にSET句を構築
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.prompt !== undefined) {
      setClauses.push(`prompt = $${paramIndex++}`);
      values.push(data.prompt);
    }
    if (data.negative_prompt !== undefined) {
      setClauses.push(`negative_prompt = $${paramIndex++}`);
      values.push(data.negative_prompt);
    }
    if (data.model !== undefined) {
      setClauses.push(`model = $${paramIndex++}`);
      values.push(data.model);
    }
    if (data.aspect_ratio !== undefined) {
      setClauses.push(`aspect_ratio = $${paramIndex++}`);
      values.push(data.aspect_ratio);
    }
    if (data.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }
    if (data.error_message !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      values.push(data.error_message);
    }
    if (data.output_id !== undefined) {
      setClauses.push(`output_id = $${paramIndex++}`);
      values.push(data.output_id);
    }
    if (data.executed_at !== undefined) {
      setClauses.push(`executed_at = $${paramIndex++}`);
      values.push(data.executed_at);
    }
    if (data.enhance_prompt !== undefined) {
      setClauses.push(`enhance_prompt = $${paramIndex++}`);
      values.push(data.enhance_prompt);
    }
    if (data.enhanced_prompt !== undefined) {
      setClauses.push(`enhanced_prompt = $${paramIndex++}`);
      values.push(data.enhanced_prompt);
    }

    if (setClauses.length === 0 && !data.images) {
      await client.query('ROLLBACK');
      return await getPromptQueueById(id);
    }

    if (setClauses.length > 0) {
      values.push(id);
      await client.query(
        `UPDATE kazikastudio.prompt_queues
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}`,
        values
      );
    }

    // 画像を更新する場合は、既存の画像を削除して再作成
    if (data.images !== undefined) {
      await client.query(
        `DELETE FROM kazikastudio.prompt_queue_images WHERE queue_id = $1`,
        [id]
      );

      for (let i = 0; i < Math.min(data.images.length, 8); i++) {
        const img = data.images[i];
        await client.query(
          `INSERT INTO kazikastudio.prompt_queue_images
           (queue_id, image_type, reference_id, display_order)
           VALUES ($1, $2, $3, $4)`,
          [id, img.image_type, img.reference_id, i]
        );
      }
    }

    await client.query('COMMIT');

    return await getPromptQueueById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * プロンプトキューを削除
 */
export async function deletePromptQueue(id: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM kazikastudio.prompt_queues WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
}

/**
 * ステータスがpendingのキューを優先度順で取得
 */
export async function getPendingPromptQueues(userId: string): Promise<PromptQueueWithImages[]> {
  const result = await query(
    `SELECT * FROM kazikastudio.prompt_queues
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY priority DESC, created_at ASC`,
    [userId]
  );

  const queues = result.rows as PromptQueue[];

  return Promise.all(
    queues.map(async (q) => {
      const images = await getPromptQueueImages(q.id);
      return {
        ...q,
        images,
        image_count: images.length,
      };
    })
  );
}

// ============================================================================
// Scene Master (m_scenes)
// ============================================================================

export interface Scene {
  id: number;
  user_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  location: string | null;
  time_of_day: string | null;
  weather: string | null;
  mood: string | null;
  prompt_hint_ja: string | null;
  prompt_hint_en: string | null;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * ユーザーのシーンマスタ一覧を取得（共有シーン含む）
 */
export async function getSceneMastersByUserId(userId: string): Promise<Scene[]> {
  const result = await query(
    `SELECT * FROM kazikastudio.m_scenes
     WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * 全てのシーンマスタを取得
 */
export async function getAllSceneMasters(): Promise<Scene[]> {
  const result = await query(
    'SELECT * FROM kazikastudio.m_scenes ORDER BY created_at DESC',
    []
  );
  return result.rows;
}

/**
 * IDでシーンマスタを取得
 */
export async function getSceneMasterById(id: number): Promise<Scene | null> {
  const result = await query(
    'SELECT * FROM kazikastudio.m_scenes WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * シーンマスタを作成
 */
export async function createSceneMaster(data: {
  user_id: string;
  name: string;
  description?: string;
  image_url?: string;
  location?: string;
  time_of_day?: string;
  weather?: string;
  mood?: string;
  prompt_hint_ja?: string;
  prompt_hint_en?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<Scene> {
  const result = await query(
    `INSERT INTO kazikastudio.m_scenes
      (user_id, name, description, image_url, location, time_of_day, weather, mood,
       prompt_hint_ja, prompt_hint_en, tags, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.user_id,
      data.name,
      data.description || null,
      data.image_url || null,
      data.location || null,
      data.time_of_day || null,
      data.weather || null,
      data.mood || null,
      data.prompt_hint_ja || null,
      data.prompt_hint_en || null,
      data.tags || [],
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * シーンマスタを更新
 */
export async function updateSceneMaster(
  id: number,
  data: {
    name?: string;
    description?: string;
    image_url?: string;
    location?: string;
    time_of_day?: string;
    weather?: string;
    mood?: string;
    prompt_hint_ja?: string;
    prompt_hint_en?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
): Promise<Scene | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.image_url !== undefined) {
    setClauses.push(`image_url = $${paramIndex++}`);
    values.push(data.image_url);
  }
  if (data.location !== undefined) {
    setClauses.push(`location = $${paramIndex++}`);
    values.push(data.location);
  }
  if (data.time_of_day !== undefined) {
    setClauses.push(`time_of_day = $${paramIndex++}`);
    values.push(data.time_of_day);
  }
  if (data.weather !== undefined) {
    setClauses.push(`weather = $${paramIndex++}`);
    values.push(data.weather);
  }
  if (data.mood !== undefined) {
    setClauses.push(`mood = $${paramIndex++}`);
    values.push(data.mood);
  }
  if (data.prompt_hint_ja !== undefined) {
    setClauses.push(`prompt_hint_ja = $${paramIndex++}`);
    values.push(data.prompt_hint_ja);
  }
  if (data.prompt_hint_en !== undefined) {
    setClauses.push(`prompt_hint_en = $${paramIndex++}`);
    values.push(data.prompt_hint_en);
  }
  if (data.tags !== undefined) {
    setClauses.push(`tags = $${paramIndex++}`);
    values.push(data.tags);
  }
  if (data.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    values.push(data.metadata);
  }

  if (setClauses.length === 0) {
    return getSceneMasterById(id);
  }

  values.push(id);

  const result = await query(
    `UPDATE kazikastudio.m_scenes
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * シーンマスタを削除
 */
export async function deleteSceneMaster(id: number): Promise<Scene | null> {
  const result = await query(
    'DELETE FROM kazikastudio.m_scenes WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// ============================================================================
// Props Master (m_props)
// ============================================================================

export interface Prop {
  id: number;
  user_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  prompt_hint_ja: string | null;
  prompt_hint_en: string | null;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * ユーザーの小物一覧を取得（共有小物含む）
 */
export async function getPropsByUserId(userId: string): Promise<Prop[]> {
  const result = await query(
    `SELECT * FROM kazikastudio.m_props
     WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * 全ての小物を取得
 */
export async function getAllProps(): Promise<Prop[]> {
  const result = await query(
    'SELECT * FROM kazikastudio.m_props ORDER BY created_at DESC',
    []
  );
  return result.rows;
}

/**
 * IDで小物を取得
 */
export async function getPropById(id: number): Promise<Prop | null> {
  const result = await query(
    'SELECT * FROM kazikastudio.m_props WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 小物を作成
 */
export async function createProp(data: {
  user_id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  prompt_hint_ja?: string;
  prompt_hint_en?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<Prop> {
  const result = await query(
    `INSERT INTO kazikastudio.m_props
      (user_id, name, description, image_url, category,
       prompt_hint_ja, prompt_hint_en, tags, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.user_id,
      data.name,
      data.description || null,
      data.image_url || null,
      data.category || null,
      data.prompt_hint_ja || null,
      data.prompt_hint_en || null,
      data.tags || [],
      data.metadata || {},
    ]
  );
  return result.rows[0];
}

/**
 * 小物を更新
 */
export async function updateProp(
  id: number,
  data: {
    name?: string;
    description?: string;
    image_url?: string;
    category?: string;
    prompt_hint_ja?: string;
    prompt_hint_en?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
): Promise<Prop | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.image_url !== undefined) {
    setClauses.push(`image_url = $${paramIndex++}`);
    values.push(data.image_url);
  }
  if (data.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }
  if (data.prompt_hint_ja !== undefined) {
    setClauses.push(`prompt_hint_ja = $${paramIndex++}`);
    values.push(data.prompt_hint_ja);
  }
  if (data.prompt_hint_en !== undefined) {
    setClauses.push(`prompt_hint_en = $${paramIndex++}`);
    values.push(data.prompt_hint_en);
  }
  if (data.tags !== undefined) {
    setClauses.push(`tags = $${paramIndex++}`);
    values.push(data.tags);
  }
  if (data.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    values.push(data.metadata);
  }

  if (setClauses.length === 0) {
    return getPropById(id);
  }

  values.push(id);

  const result = await query(
    `UPDATE kazikastudio.m_props
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 小物を削除
 */
export async function deleteProp(id: number): Promise<Prop | null> {
  const result = await query(
    'DELETE FROM kazikastudio.m_props WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}
