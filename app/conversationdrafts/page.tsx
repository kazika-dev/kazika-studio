'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StoryItem {
  id: number;
  title: string;
}

interface SceneItem {
  id: number;
  title: string;
}

interface ConversationItem {
  id: number;
  title: string;
}

const DEFAULT_STORY_ID = 5;

export default function ConversationDraftsPage() {
  const router = useRouter();

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newConversationTitle, setNewConversationTitle] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadStories = useCallback(async () => {
    const response = await fetch('/api/stories');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'ストーリーの取得に失敗しました');
    }

    const list: StoryItem[] = result.data?.stories || [];
    setStories(list);

    if (list.length === 0) {
      setSelectedStoryId(null);
      setScenes([]);
      setSelectedSceneId(null);
      return;
    }

    setSelectedStoryId((prev) => {
      if (list.some((story) => story.id === DEFAULT_STORY_ID)) {
        return DEFAULT_STORY_ID;
      }
      if (prev && list.some((story) => story.id === prev)) return prev;
      return list[0].id;
    });
  }, []);

  const loadScenes = useCallback(async (storyId: number) => {
    const response = await fetch(`/api/stories/${storyId}/scenes`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'シーンの取得に失敗しました');
    }

    const list: SceneItem[] = (result.data?.scenes || []).sort((a: SceneItem, b: SceneItem) => b.id - a.id);
    setScenes(list);

    if (list.length === 0) {
      setSelectedSceneId(null);
      return;
    }

    setSelectedSceneId((prev) => {
      if (prev && list.some((scene) => scene.id === prev)) return prev;
      return list[0].id;
    });
  }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/conversations?limit=200');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || '会話一覧の取得に失敗しました');
    }

    const list: ConversationItem[] = result.data?.conversations || [];
    setConversations(list);

    if (list.length === 0) {
      setSelectedConversationId(null);
      return;
    }

    setSelectedConversationId((prev) => {
      if (prev && list.some((conversation) => conversation.id === prev)) return prev;
      return list[0].id;
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        await Promise.all([loadStories(), loadConversations()]);
      } catch (error) {
        const message = error instanceof Error ? error.message : '初期化に失敗しました';
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [loadConversations, loadStories]);

  useEffect(() => {
    if (!selectedStoryId) {
      setScenes([]);
      setSelectedSceneId(null);
      return;
    }

    const run = async () => {
      try {
        setErrorMessage('');
        await loadScenes(selectedStoryId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'シーンの読み込みに失敗しました';
        setErrorMessage(message);
      }
    };

    void run();
  }, [loadScenes, selectedStoryId]);

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim()) return;

    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newStoryTitle.trim() }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ストーリー追加に失敗しました');
      }

      const createdStoryId = result.data?.story?.id as number | undefined;
      setNewStoryTitle('');
      await loadStories();
      if (createdStoryId) setSelectedStoryId(createdStoryId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ストーリー追加に失敗しました';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateScene = async () => {
    if (!selectedStoryId) {
      setErrorMessage('先にストーリーを選択してください');
      return;
    }
    if (!newSceneTitle.trim()) return;

    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/stories/${selectedStoryId}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSceneTitle.trim() }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'シーン追加に失敗しました');
      }

      const createdSceneId = result.data?.scene?.id as number | undefined;
      setNewSceneTitle('');
      await loadScenes(selectedStoryId);
      if (createdSceneId) setSelectedSceneId(createdSceneId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'シーン追加に失敗しました';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!selectedSceneId) {
      setErrorMessage('先にシーンを選択してください');
      return;
    }

    const title = newConversationTitle.trim() || '新規会話';

    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          storySceneId: selectedSceneId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '会話作成に失敗しました');
      }

      const conversationId = result.data?.conversation?.id;
      if (!conversationId) {
        throw new Error('作成した会話IDが取得できませんでした');
      }

      setNewConversationTitle('');
      router.push(`/conversationdrafts/${conversationId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '会話作成に失敗しました';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:py-6">
        <h1 className="text-lg font-semibold text-gray-900">会話下書き</h1>
        <p className="mt-1 text-sm text-gray-600">story_id / story_scene_id を選択して会話を新規作成できます</p>

        {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 block text-sm font-medium text-gray-700">既存会話を開く</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedConversationId || ''}
              onChange={(e) => setSelectedConversationId(Number(e.target.value))}
              className="h-12 w-full flex-1 rounded-md border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-blue-500"
            >
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.id}: {conversation.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedConversationId}
              onClick={() => selectedConversationId && router.push(`/conversationdrafts/${selectedConversationId}`)}
              className="h-12 w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50 sm:w-auto"
            >
              開く
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 block text-sm font-medium text-gray-700">story_id（ストーリー）</label>
          <select
            value={selectedStoryId || ''}
            onChange={(e) => setSelectedStoryId(Number(e.target.value))}
            className="h-12 w-full rounded-md border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-blue-500"
          >
            {stories.map((story) => (
              <option key={story.id} value={story.id}>
                {story.id}: {story.title}
              </option>
            ))}
          </select>

          <div className="mt-3 flex gap-2">
            <input
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="新規ストーリー名"
              className="h-11 flex-1 rounded-md border border-gray-300 px-3 text-base outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={submitting || !newStoryTitle.trim()}
              onClick={() => void handleCreateStory()}
              className="rounded-md border border-blue-600 px-4 py-2 text-sm text-blue-700 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 block text-sm font-medium text-gray-700">story_scene_id（シーン）</label>
          <select
            value={selectedSceneId || ''}
            onChange={(e) => setSelectedSceneId(Number(e.target.value))}
            className="h-12 w-full rounded-md border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-blue-500"
          >
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.id}: {scene.title}
              </option>
            ))}
          </select>

          <div className="mt-3 flex gap-2">
            <input
              value={newSceneTitle}
              onChange={(e) => setNewSceneTitle(e.target.value)}
              placeholder="新規シーン名"
              className="h-11 flex-1 rounded-md border border-gray-300 px-3 text-base outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={submitting || !selectedStoryId || !newSceneTitle.trim()}
              onClick={() => void handleCreateScene()}
              className="rounded-md border border-blue-600 px-4 py-2 text-sm text-blue-700 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 block text-sm font-medium text-gray-700">会話タイトル</label>
          <input
            value={newConversationTitle}
            onChange={(e) => setNewConversationTitle(e.target.value)}
            placeholder="新規会話"
            className="h-12 w-full rounded-md border border-gray-300 px-3 text-base outline-none focus:border-blue-500"
          />

          <button
            type="button"
            disabled={submitting || !selectedSceneId}
            onClick={() => void handleCreateConversation()}
            className="mt-3 h-11 w-full rounded-md bg-blue-600 text-base font-medium text-white disabled:opacity-50"
          >
            会話を作成して下書きを開く
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <Link href="/conversationsfocus" className="text-blue-600 underline">
            会話管理ページを開く
          </Link>
        </div>
      </div>
    </div>
  );
}
