import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

export type AuthMethod = 'cookie' | 'apiKey' | 'jwt' | null;

export type AuthUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  role?: string;
};

export async function authenticateRequest(request: NextRequest): Promise<AuthUser | null> {
  const result = await authenticateRequestWithMethod(request);
  return result.user;
}

export async function authenticateRequestWithMethod(request: NextRequest): Promise<{
  user: AuthUser | null;
  authMethod: AuthMethod;
}> {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    if (token.startsWith('sk_')) {
      console.log('[API Auth] Using API key authentication');
      const user = await authenticateWithApiKey(token);

      if (user) {
        console.log('[API Auth] API key authentication successful:', user.id);
        return { user, authMethod: 'apiKey' };
      }
      console.log('[API Auth] API key authentication failed');
    } else {
      console.log('[API Auth] JWT bearer authentication is not available after Auth.js migration');
    }
  }

  console.log('[API Auth] Using Cookie session authentication');
  try {
    const db = await createServerClient();
    const { data: { user }, error } = await db.auth.getUser();

    if (error) {
      console.error('[API Auth] Cookie session authentication error:', error);
      return { user: null, authMethod: null };
    }

    if (user) {
      console.log('[API Auth] Cookie session authentication successful:', user.id);
      return { user, authMethod: 'cookie' };
    }

    console.log('[API Auth] Cookie session authentication failed - no user');
    return { user: null, authMethod: null };
  } catch (error) {
    console.error('[API Auth] Cookie session authentication exception:', error);
    return { user: null, authMethod: null };
  }
}

export async function getAuthenticatedSupabase(request: NextRequest): Promise<{
  user: AuthUser | null;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  authMethod: AuthMethod;
}> {
  const { user, authMethod } = await authenticateRequestWithMethod(request);
  const supabase = await createServerClient();
  return { user, supabase, authMethod: user ? authMethod : null };
}

async function authenticateWithApiKey(apiKey: string): Promise<AuthUser | null> {
  try {
    const keyHash = hashApiKey(apiKey);

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
      INNER JOIN kazikastudio.app_users u ON ak.user_id = u.id
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

    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      console.warn('Expired API key used:', apiKeyRecord.id);
      return null;
    }

    updateLastUsedAt(apiKeyRecord.id).catch((err) =>
      console.error('Failed to update last_used_at:', err)
    );

    return {
      id: apiKeyRecord.user_id,
      email: apiKeyRecord.email,
      created_at: apiKeyRecord.user_created_at,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
    };
  } catch (error) {
    console.error('API key authentication error:', error);
    return null;
  }
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function generateApiKey(): string {
  const base64 = randomBytes(24).toString('base64')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, 32);

  return `sk_${base64}`;
}

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

export async function requireAuth(request: NextRequest): Promise<{
  user: AuthUser | null;
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
