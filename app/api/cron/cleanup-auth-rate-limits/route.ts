import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredRateLimits } from '@/lib/auth/security';

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deleted = await cleanupExpiredRateLimits();
  return NextResponse.json({ success: true, deleted });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
