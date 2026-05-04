import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { isStrongPassword, publicErrorDetails } from '@/lib/auth/security';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '現在のパスワードと新しいパスワードを入力してください' }, { status: 400 });
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        { error: '新しいパスワードは10文字以上で、英字と数字を含めてください' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: '現在とは違うパスワードを指定してください' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, password_hash
       FROM kazikastudio.app_users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const appUser = result.rows[0];
    if (!appUser || !verifyPassword(currentPassword, appUser.password_hash)) {
      return NextResponse.json({ error: '現在のパスワードが違います' }, { status: 403 });
    }

    const nextHash = hashPassword(newPassword);
    await query(
      `UPDATE kazikastudio.app_users
       SET password_hash = $2,
           updated_at = timezone('utc'::text, now()),
           login_failed_count = 0,
           last_failed_login_at = NULL
       WHERE id = $1`,
      [userId, nextHash]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Password change error:', error);
    return NextResponse.json(
      {
        error: 'パスワード変更に失敗しました',
        details: publicErrorDetails(message),
      },
      { status: 500 }
    );
  }
}
