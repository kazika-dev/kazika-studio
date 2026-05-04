import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import {
  checkRateLimit,
  getClientIp,
  isSignupEnabled,
  isStrongPassword,
  publicErrorDetails,
  rateLimitResponse,
  verifySignupInviteCode,
} from '@/lib/auth/security';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET() {
  return NextResponse.json({ enabled: isSignupEnabled() });
}

export async function POST(request: NextRequest) {
  try {
    if (!isSignupEnabled()) {
      return NextResponse.json({ error: '新規登録は現在停止しています' }, { status: 403 });
    }

    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(`signup:ip:${clientIp}`, 5, 60 * 60 * 1000);
    if (!ipLimit.allowed) {
      return rateLimitResponse(ipLimit.resetAt);
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const inviteCode = String(body.inviteCode || '');
    const name = body.name ? String(body.name).trim() : null;

    if (!verifySignupInviteCode(inviteCode)) {
      return NextResponse.json({ error: '招待コードが違います' }, { status: 403 });
    }

    if (email) {
      const emailLimit = await checkRateLimit(`signup:email:${email}`, 3, 60 * 60 * 1000);
      if (!emailLimit.allowed) {
        return rateLimitResponse(emailLimit.resetAt);
      }
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: 'パスワードは10文字以上で、英字と数字を含めてください' },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);

    const result = await query(
      `INSERT INTO kazikastudio.app_users (email, name, password_hash, email_verified)
       VALUES ($1, $2, $3, timezone('utc'::text, now()))
       RETURNING id, email, name`,
      [email, name, passwordHash]
    );

    return NextResponse.json({ success: true, user: result.rows[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('duplicate key')) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
    }

    console.error('Auth.js signup error:', error);
    return NextResponse.json(
      {
        error: 'アカウント作成に失敗しました',
        details: publicErrorDetails(message),
      },
      { status: 500 }
    );
  }
}
