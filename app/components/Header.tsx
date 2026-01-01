'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

import { LogOut, User, Workflow, Home, Image, Video, MessageCircle, Database, Key, Menu as MenuIcon, X, ListOrdered } from 'lucide-react';

import type { User as SupabaseUser } from '@supabase/supabase-js';
import Link from 'next/link';
import { Menu, MenuItem, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';

// ナビゲーションアイテムの定義
const navItems = [
  { href: '/', label: 'ホーム', icon: Home, matchExact: true },
  { href: '/outputs', label: 'アウトプット', icon: Image, matchExact: true },
  { href: '/studios', label: 'スタジオ', icon: Video, matchExact: false },
  { href: '/conversations', label: '会話', icon: MessageCircle, matchExact: false },
  { href: '/prompt-queue', label: 'プロンプトキュー', icon: ListOrdered, matchExact: false },
  { href: '/master', label: 'マスター管理', icon: Database, matchExact: false },
];

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const menuOpen = Boolean(anchorEl);

  useEffect(() => {
    // 初期ユーザー取得
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // 認証状態の変化を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    setMobileMenuOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleNavigateToSettings = () => {
    handleMenuClose();
    setMobileMenuOpen(false);
    router.push('/settings/api-keys');
  };

  const isActiveLink = (href: string, matchExact: boolean) => {
    if (matchExact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  if (!user) return null;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* ロゴとナビゲーション */}
          <div className="flex items-center gap-6">
            {/* モバイルメニューボタン */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="メニューを開く"
            >
              <MenuIcon size={24} />
            </button>

            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Workflow size={24} />
              <span className="hidden sm:inline">Kazika Studio</span>
            </Link>

            {/* デスクトップナビゲーション */}
            <nav className="hidden lg:flex items-center gap-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveLink(item.href, item.matchExact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ユーザー情報とメニュー */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMenuOpen}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <User size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="hidden sm:inline text-sm max-w-[150px] truncate">{user.email}</span>
            </button>

            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleNavigateToSettings}>
                <Key size={16} className="mr-2" />
                API キー管理
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <LogOut size={16} className="mr-2" />
                ログアウト
              </MenuItem>
            </Menu>
          </div>
        </div>
      </div>

      {/* モバイルドロワーメニュー */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            backgroundColor: '#ffffff',
            '@media (prefers-color-scheme: dark)': {
              backgroundColor: '#1f2937',
            },
          },
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
          >
            <Workflow size={24} />
            <span>Kazika Studio</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="メニューを閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <List>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveLink(item.href, item.matchExact);
            return (
              <ListItem key={item.href} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  sx={{
                    backgroundColor: isActive ? 'rgb(219 234 254)' : 'transparent',
                    '&:hover': {
                      backgroundColor: isActive ? 'rgb(191 219 254)' : 'rgb(243 244 246)',
                    },
                    '@media (prefers-color-scheme: dark)': {
                      backgroundColor: isActive ? 'rgb(30 58 138)' : 'transparent',
                      '&:hover': {
                        backgroundColor: isActive ? 'rgb(30 64 175)' : 'rgb(55 65 81)',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Icon
                      size={20}
                      className={isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      className: isActive
                        ? 'text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Divider />

        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={handleNavigateToSettings}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Key size={20} className="text-gray-600 dark:text-gray-400" />
              </ListItemIcon>
              <ListItemText
                primary="API キー管理"
                primaryTypographyProps={{
                  className: 'text-gray-700 dark:text-gray-300',
                }}
              />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <LogOut size={20} className="text-gray-600 dark:text-gray-400" />
              </ListItemIcon>
              <ListItemText
                primary="ログアウト"
                primaryTypographyProps={{
                  className: 'text-gray-700 dark:text-gray-300',
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>

        {/* ユーザー情報 */}
        <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <User size={20} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{user.email}</span>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
