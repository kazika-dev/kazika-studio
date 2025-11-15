'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Workflow, Home, Image, Video, Users, MessageCircle } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import Link from 'next/link';

export default function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (!user) return null;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="w-full px-4 py-3">
        <div className="flex items-center justify-between">
          {/* ロゴとナビゲーション */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Workflow size={24} />
              <span>Kazika Studio</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname === '/'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Home size={16} />
                ホーム
              </Link>
              <Link
                href="/workflow"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname === '/workflow'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Workflow size={16} />
                ワークフロー
              </Link>
              <Link
                href="/outputs"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname === '/outputs'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Image size={16} />
                アウトプット
              </Link>
              <Link
                href="/studios"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname.startsWith('/studios')
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Video size={16} />
                スタジオ
              </Link>
              <Link
                href="/character-sheets"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname.startsWith('/character-sheets')
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Users size={16} />
                キャラクターシート
              </Link>
              <Link
                href="/conversations"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname.startsWith('/conversations')
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageCircle size={16} />
                会話
              </Link>
            </nav>
          </div>

          {/* ユーザー情報とログアウト */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
