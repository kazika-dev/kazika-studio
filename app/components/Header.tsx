'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Workflow, Home, ImageIcon, Video, Users, MessageCircle, Database } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
    router.refresh();
  };

  if (status === 'loading' || !session?.user) return null;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
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
                href="/outputs"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname === '/outputs'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ImageIcon size={16} />
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
              <Link
                href="/master"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  pathname.startsWith('/master')
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Database size={16} />
                マスター管理
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {session.user.email}
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
