'use client';

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
    <>
      {!hideHeader && <Header />}
      {children}
    </>
  );
}
