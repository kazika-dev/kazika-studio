import { NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import { query } from '@/lib/db';
import type { User } from '@supabase/supabase-js';

/**
 * API リクエストを認証する
 *
 * 以下の認証方法をサポート:
 * 1. Authorization: Bearer <api-key> ヘッダー（Chrome Extension用）
 * 2. Cookie セッション（既存のブラウザ認証）
 *
 * @param request Next.js Request オブジェクト
 * @returns 認証されたユーザー情報、または null
 */
export async function authenticateRequest(request: NextRequest): Promise<User | null> {
  // 1. Authorization ヘッダーをチェック
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    console.log('[API Auth] Using API key authentication');
    const apiKey = authHeader.substring(7); // "Bearer " を除去
    const user = await authenticateWithApiKey(apiKey);

    if (user) {
      console.log('[API Auth] API key authentication successful:', user.id);
      return user;
    }
    console.log('[API Auth] API key authentication failed');
  }

  // 2. Cookie セッションで認証（既存の方法）
  console.log('[API Auth] Using Cookie session authentication');
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[API Auth] Cookie session authentication error:', error);
      return null;
    }

    if (user) {
      console.log('[API Auth] Cookie session authentication successful:', user.id);
    } else {
      console.log('[API Auth] Cookie session authentication failed - no user');
    }

    return user;
  } catch (error) {
    console.error('[API Auth] Cookie session authentication exception:', error);
    return null;
  }
}

/**
 * API キーで認証する
 *
 * @param apiKey プレーンテキストの API キー
 * @returns 認証されたユーザー情報、または null
 */
async function authenticateWithApiKey(apiKey: string): Promise<User | null> {
  try {
    // API キーをハッシュ化
    const keyHash = hashApiKey(apiKey);

    // データベースで API キーを検索
    const result = await query(
      `
      SELECT
        ak.id,
        ak.user_id,
        ak.expires_at,
        ak.is_active,
        u.email,
        u.created_at as user_created_at
      FROM kazikastudio.api_keys ak
      INNER JOIN auth.users u ON ak.user_id = u.id
      WHERE ak.key_hash = $1
        AND ak.is_active = TRUE
      `,
      [keyHash]
    );

    if (result.rows.length === 0) {
      console.warn('Invalid API key attempt');
      return null;
    }

    const apiKeyRecord = result.rows[0];

    // 有効期限チェック
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      console.warn('Expired API key used:', apiKeyRecord.id);
      return null;
    }

    // 最終使用日時を更新（非同期、エラーは無視）
    updateLastUsedAt(apiKeyRecord.id).catch(err =>
      console.error('Failed to update last_used_at:', err)
    );

    // Supabase User 型に変換
    const user: User = {
      id: apiKeyRecord.user_id,
      email: apiKeyRecord.email,
      created_at: apiKeyRecord.user_created_at,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
    };

    return user;
  } catch (error) {
    console.error('API key authentication error:', error);
    return null;
  }
}

/**
 * API キーをハッシュ化（SHA-256）
 *
 * @param apiKey プレーンテキストの API キー
 * @returns ハッシュ化された API キー
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * ランダムな API キーを生成
 *
 * フォーマット: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (35文字)
 *
 * @returns 新しい API キー
 */
export function generateApiKey(): string {
  const randomBytes = require('crypto').randomBytes(24);
  const base64 = randomBytes.toString('base64')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, 32);

  return `sk_${base64}`;
}

/**
 * API キーの最終使用日時を更新
 *
 * @param apiKeyId API キーの ID
 */
async function updateLastUsedAt(apiKeyId: string): Promise<void> {
  await query(
    `
    UPDATE kazikastudio.api_keys
    SET last_used_at = NOW()
    WHERE id = $1
    `,
    [apiKeyId]
  );
}

/**
 * ユーザー ID で認証チェック（APIエンドポイント用ヘルパー）
 *
 * @param request Next.js Request オブジェクト
 * @returns { user: User | null, unauthorized: Response | null }
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: User | null;
  unauthorized: Response | null;
}> {
  const user = await authenticateRequest(request);

  if (!user) {
    return {
      user: null,
      unauthorized: Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return { user, unauthorized: null };
}
