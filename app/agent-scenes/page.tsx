'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertCircle, Clapperboard, Film, Mic2, ScrollText } from 'lucide-react';

type AgentScene = {
  id: number;
  title: string;
  description?: string | null;
  summary?: string | null;
  location?: string | null;
  time_of_day?: string | null;
  mood?: string | null;
  sequence_order: number;
  story_title: string;
  script_count: number;
  line_count: number;
  shot_count: number;
  asset_count: number;
  audio_count: number;
  image_count: number;
  video_count: number;
};

export default function AgentScenesPage() {
  const [scenes, setScenes] = useState<AgentScene[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/agent-scenes?limit=200');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'シーン一覧の取得に失敗しました');
        }
        setScenes(result.data?.scenes || []);
        setTotal(result.data?.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'シーン一覧の取得に失敗しました');
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
              <Clapperboard size={16} /> kazika_studio_agents
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">新シーン一覧</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              agentsスキーマのストーリーシーン、台本、ショット、素材を制作単位で確認します。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            合計 <span className="font-semibold text-slate-900 dark:text-white">{total}</span> シーン
          </div>
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
        ) : scenes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            agentsスキーマに表示できるシーンがまだありません。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scenes.map((scene) => (
              <Link
                key={scene.id}
                href={`/agent-scenes/${scene.id}`}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-indigo-600 dark:text-indigo-300">{scene.story_title}</p>
                    <h2 className="mt-1 line-clamp-2 text-xl font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
                      {scene.title}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    #{scene.sequence_order}
                  </span>
                </div>

                <p className="mb-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {scene.summary || scene.description || 'シーン概要は未設定です。'}
                </p>

                <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {scene.location && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{scene.location}</span>}
                  {scene.time_of_day && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{scene.time_of_day}</span>}
                  {scene.mood && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{scene.mood}</span>}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <Metric icon={<ScrollText size={15} />} label="台本" value={scene.script_count} />
                  <Metric icon={<Clapperboard size={15} />} label="ショット" value={scene.shot_count} />
                  <Metric icon={<Mic2 size={15} />} label="音声" value={scene.audio_count} />
                  <Metric icon={<Film size={15} />} label="動画" value={scene.video_count || scene.image_count} />
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
