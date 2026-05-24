'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Clapperboard, Film, Mic2, ScrollText } from 'lucide-react';

type AgentStory = {
  id: number;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  updated_at?: string | null;
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
  project_key?: string | null;
  genre_mode?: string | null;
  production_status?: string | null;
  episode_no?: string | null;
  script_count: number;
  line_count: number;
  shot_count: number;
  asset_count: number;
  audio_count: number;
  image_count: number;
  video_count: number;
};

export default function AgentScenesPage() {
  const [stories, setStories] = useState<AgentStory[]>([]);
  const [scenes, setScenes] = useState<AgentScene[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [genreMode, setGenreMode] = useState('');
  const [productionStatus, setProductionStatus] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ limit: '200' });
        if (projectKey.trim()) params.set('project_key', projectKey.trim());
        if (genreMode) params.set('genre_mode', genreMode);
        if (productionStatus) params.set('production_status', productionStatus);
        if (selectedStoryId) params.set('story_id', selectedStoryId);
        const response = await fetch(`/api/agent-scenes?${params.toString()}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'シーン一覧の取得に失敗しました');
        }
        setStories(result.data?.stories || []);
        setScenes(result.data?.scenes || []);
        setTotal(result.data?.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'シーン一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [projectKey, genreMode, productionStatus, selectedStoryId]);

  const selectedStory = stories.find((story) => String(story.id) === selectedStoryId);
  const hasFilters = Boolean(projectKey.trim() || genreMode || productionStatus || selectedStoryId);

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

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">作品フィルタ</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">stories / scenes の metadata に入れた project_key・genre_mode・production_status で絞り込みます。</p>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setProjectKey(''); setGenreMode(''); setProductionStatus(''); setSelectedStoryId(''); }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
              >
                クリア
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              project_key
              <input
                value={projectKey}
                onChange={(event) => setProjectKey(event.target.value)}
                placeholder="例: romcom01"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              genre_mode
              <select
                value={genreMode}
                onChange={(event) => setGenreMode(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">すべて</option>
                <option value="romcom">romcom / ラブコメ</option>
                <option value="narou">narou / なろう系</option>
                <option value="fantasy">fantasy</option>
                <option value="slice_of_life">slice_of_life</option>
                <option value="horror">horror</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              production_status
              <select
                value={productionStatus}
                onChange={(event) => setProductionStatus(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">すべて</option>
                <option value="idea">idea / 構想中</option>
                <option value="outline">outline / 企画・構成</option>
                <option value="script">script / 脚本中</option>
                <option value="image">image / 画像制作</option>
                <option value="video">video / 動画制作</option>
                <option value="published">published / 公開済み</option>
              </select>
            </label>
          </div>
        </section>


        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <BookOpen size={19} /> ストーリー
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ストーリーを選ぶと、下のシーン一覧がそのストーリーだけに切り替わります。
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {stories.length} ストーリー
            </span>
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              表示できるストーリーがまだありません。
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => setSelectedStoryId(String(story.id))}
                  className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-sm dark:hover:border-indigo-700 dark:hover:bg-slate-900 ${String(story.id) === selectedStoryId ? 'border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-700 dark:bg-indigo-950/40' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300">Story #{story.id}</p>
                      <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
                        {story.title}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {story.scene_count} scenes
                    </span>
                  </div>
                  <p className="mb-3 line-clamp-2 min-h-[2.75rem] text-sm leading-5 text-slate-600 dark:text-slate-300">
                    {story.description || 'ストーリー説明は未設定です。'}
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
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
                </button>
              ))}
            </div>
          )}
        </section>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error}</p>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">シーン一覧</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {selectedStory ? `選択中: ${selectedStory.title}` : '全ストーリーのシーンを表示中'}
            </p>
          </div>
          {selectedStoryId && (
            <button
              type="button"
              onClick={() => setSelectedStoryId('')}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
            >
              全シーンに戻す
            </button>
          )}
        </div>

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
                  {scene.project_key && <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{scene.project_key}</span>}
                  {scene.genre_mode && <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700 dark:bg-violet-950 dark:text-violet-200">{scene.genre_mode}</span>}
                  {scene.production_status && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{scene.production_status}</span>}
                  {scene.episode_no && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">Ep.{scene.episode_no}</span>}
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
