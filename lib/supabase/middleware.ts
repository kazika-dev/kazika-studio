import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションの更新（有効期限の延長など）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 認証が必要なパス
  const protectedPaths = ['/', '/workflow'];
  const isProtectedPath = protectedPaths.some((path) =>
    path === '/'
      ? request.nextUrl.pathname === '/'
      : request.nextUrl.pathname.startsWith(path)
  );

  // 未認証でprotectedPathsにアクセスしようとした場合、/loginにリダイレクト
  if (isProtectedPath && !user && request.nextUrl.pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 認証済みで/loginにアクセスしようとした場合、/にリダイレクト
  if (request.nextUrl.pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
