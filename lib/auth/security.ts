import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export function assertAuthSecretConfigured() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.includes('replace_with') || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to a strong random value in production.');
  }
}

export function getClientIp(request: Request | NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const result = await query(
    `WITH upserted AS (
       INSERT INTO kazikastudio.auth_rate_limits (key, count, reset_at)
       VALUES ($1, 1, timezone('utc'::text, now()) + ($3::int * interval '1 second'))
       ON CONFLICT (key) DO UPDATE SET
         count = CASE
           WHEN kazikastudio.auth_rate_limits.reset_at <= timezone('utc'::text, now()) THEN 1
           ELSE kazikastudio.auth_rate_limits.count + 1
         END,
         reset_at = CASE
           WHEN kazikastudio.auth_rate_limits.reset_at <= timezone('utc'::text, now())
             THEN timezone('utc'::text, now()) + ($3::int * interval '1 second')
           ELSE kazikastudio.auth_rate_limits.reset_at
         END
       RETURNING count, reset_at
     )
     SELECT count, reset_at FROM upserted`,
    [key, limit, windowSeconds]
  );

  const row = result.rows[0];
  const count = Number(row?.count || 0);
  const resetAt = row?.reset_at instanceof Date
    ? row.reset_at.getTime()
    : new Date(row?.reset_at).getTime();

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export async function cleanupExpiredRateLimits() {
  const result = await query(
    `DELETE FROM kazikastudio.auth_rate_limits
     WHERE reset_at <= timezone('utc'::text, now())
     RETURNING key`,
  );

  return result.rowCount || 0;
}

export function rateLimitResponse(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: '試行回数が多すぎます。少し時間を置いて再試行してください' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

export function isStrongPassword(password: string) {
  if (password.length < 10) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export function publicErrorDetails(message: string) {
  if (process.env.NODE_ENV === 'production') return undefined;
  return message;
}
