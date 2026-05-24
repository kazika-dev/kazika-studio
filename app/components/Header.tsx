'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Workflow, Home, ImageIcon, Video, Users, MessageCircle, Database, KeyRound, ChevronDown, Menu, X, BookOpen, Clapperboard } from 'lucide-react';
import Link from 'next/link';

const navItems = [
  { href: '/', label: 'ホーム', icon: Home, active: (pathname: string) => pathname === '/' },
  { href: '/outputs', label: 'アウトプット', icon: ImageIcon, active: (pathname: string) => pathname === '/outputs' },
  { href: '/studios', label: 'スタジオ', icon: Video, active: (pathname: string) => pathname.startsWith('/studios') },
  { href: '/agent-stories', label: 'ストーリー', icon: BookOpen, active: (pathname: string) => pathname.startsWith('/agent-stories') },
  { href: '/agent-scenes', label: '新シーン', icon: Clapperboard, active: (pathname: string) => pathname.startsWith('/agent-scenes') },
  { href: '/character-sheets', label: 'キャラクターシート', icon: Users, active: (pathname: string) => pathname.startsWith('/character-sheets') },
  { href: '/conversations', label: '会話', icon: MessageCircle, active: (pathname: string) => pathname.startsWith('/conversations') },
  { href: '/master', label: 'マスター管理', icon: Database, active: (pathname: string) => pathname.startsWith('/master') },
];

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen && !userMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, userMenuOpen]);

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
    router.refresh();
  };

  if (status === 'loading' || !session?.user) return null;

  const renderNavLink = (item: (typeof navItems)[number], variant: 'desktop' | 'mobile') => {
    const Icon = item.icon;
    const isActive = item.active(pathname);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMenus}
        className={`flex items-center gap-2 rounded-lg transition-colors ${
          variant === 'mobile'
            ? 'px-3 py-3 text-sm'
            : 'shrink-0 px-3 py-2 text-sm'
        } ${
          isActive
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
      >
        <Icon size={16} className="shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="relative mx-auto px-3 py-2 sm:px-4 sm:py-3" ref={headerRef}>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 text-base font-semibold text-gray-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400 sm:text-lg"
          >
            <Workflow size={24} className="shrink-0" />
            <span className="truncate">Kazika Studio</span>
          </Link>

          <nav className="hidden gap-2 md:flex xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2">
            {navItems.map((item) => renderNavLink(item, 'desktop'))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((open) => !open);
                setUserMenuOpen(false);
              }}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 md:hidden"
              aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((open) => !open);
                  setMobileMenuOpen(false);
                }}
                className="flex max-w-[44vw] items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 sm:max-w-[280px] sm:px-3"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label="ユーザーメニューを開く"
              >
                <User size={20} className="shrink-0 text-gray-600 dark:text-gray-400" />
                <span className="hidden truncate sm:inline">{session.user.name || session.user.email}</span>
                <ChevronDown size={16} className={`hidden shrink-0 transition-transform sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:w-64"
                >
                  <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {session.user.name || 'ユーザー'}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {session.user.email}
                    </p>
                  </div>

                  <Link
                    href="/settings/password"
                    role="menuitem"
                    onClick={closeMenus}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <KeyRound size={16} />
                    パスワード変更
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <LogOut size={16} />
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-navigation"
            className="mt-2 grid gap-1 rounded-xl border border-gray-200 bg-gray-50 p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:hidden"
          >
            {navItems.map((item) => renderNavLink(item, 'mobile'))}
          </nav>
        )}
      </div>
    </header>
  );
}
