'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Clapperboard, Film, Mic2, ScrollText } from 'lucide-react';

type AgentStory = {
  id: number;
  title: string;
  description?: string | null;
  project_key?: string | null;
  genre_mode?: string | null;
  production_status?: string | null;
  scene_count: number;
  first_scene_id?: number | null;
  script_count: number;
  line_count: number;
  shot_count: number;
  asset_count: number;
  audio_count: number;
  image_count: number;
  video_count: number;
};

export default function AgentStoriesPage() {
  const [stories, setStories] = useState<AgentStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/agent-scenes?limit=1');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'ストーリー一覧の取得に失敗しました');
        }
        setStories(result.data?.stories || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ストーリー一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
              <BookOpen size={16} /> kazika_studio_agents
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">ストーリー一覧</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Agent側のストーリーを選んで、その作品のシーン一覧へ移動します。
            </p>
          </div>
          <Link
            href="/agent-scenes"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
          >
            全シーン一覧へ
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-3xl bg-white shadow-sm dark:bg-slate-900" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            表示できるストーリーがまだありません。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stories.map((story) => (
              <Link
                key={story.id}
                href={`/agent-scenes?story_id=${story.id}`}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300">Story #{story.id}</p>
                    <h2 className="mt-1 line-clamp-2 text-xl font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
                      {story.title}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {story.scene_count} scenes
                  </span>
                </div>

                <p className="mb-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {story.description || 'ストーリー説明は未設定です。'}
                </p>

                <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {story.project_key && <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{story.project_key}</span>}
                  {story.genre_mode && <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700 dark:bg-violet-950 dark:text-violet-200">{story.genre_mode}</span>}
                  {story.production_status && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{story.production_status}</span>}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <Metric icon={<ScrollText size={15} />} label="台本" value={story.script_count} />
                  <Metric icon={<Clapperboard size={15} />} label="ショット" value={story.shot_count} />
                  <Metric icon={<Mic2 size={15} />} label="音声" value={story.audio_count} />
                  <Metric icon={<Film size={15} />} label="画像/動画" value={story.video_count || story.image_count} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <div className="mx-auto mb-1 flex justify-center text-slate-400">{icon}</div>
      <div className="font-semibold text-slate-900 dark:text-white">{value}</div>
      <div>{label}</div>
    </div>
  );
}
