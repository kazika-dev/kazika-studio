'use client';

import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Header from './Header';

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ログインページではヘッダーを表示しない
  const hideHeader = pathname === '/login';

  return (
    <SessionProvider>
      {!hideHeader && <Header />}
      {children}
    </SessionProvider>
  );
}
