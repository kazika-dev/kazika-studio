'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ConversationItem {
  id: number;
  title: string;
  draft?: string | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ConversationDraftByIdPage() {
  const params = useParams<{ id: string }>();
  const conversationId = Number(params.id);

  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDraftRef = useRef('');

  const loadConversation = useCallback(async () => {
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      setErrorMessage('不正な会話IDです');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '会話の取得に失敗しました');
      }

      const nextConversation: ConversationItem = result.data.conversation;
      const nextDraft = nextConversation.draft || '';
      setConversation(nextConversation);
      setDraftText(nextDraft);
      lastSavedDraftRef.current = nextDraft;
    } catch (error) {
      const message = error instanceof Error ? error.message : '会話の取得に失敗しました';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  const saveDraft = useCallback(async (nextDraft: string) => {
    if (!conversationId || !conversation) return;

    setSaveState('saving');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: nextDraft }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存に失敗しました');
      }

      lastSavedDraftRef.current = nextDraft;
      setConversation((prev) => (prev ? { ...prev, draft: nextDraft } : prev));
      setSaveState('saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました';
      setSaveState('error');
      setErrorMessage(message);
    }
  }, [conversation, conversationId]);

  useEffect(() => {
    if (!conversation) return;
    if (draftText === lastSavedDraftRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void saveDraft(draftText);
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [conversation, draftText, saveDraft]);

  const statusLabel =
    saveState === 'saving'
      ? '保存中...'
      : saveState === 'saved'
      ? '保存済み'
      : saveState === 'error'
      ? '保存エラー'
      : '';

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
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-gray-900">会話下書きエディタ</h1>
          <Link href="/conversationdrafts" className="text-sm text-blue-600 underline">
            一覧へ
          </Link>
        </div>

        {conversation && (
          <p className="mt-1 text-sm text-gray-600">
            ID: {conversation.id} / {conversation.title}
          </p>
        )}

        {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}

        {conversation && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>{conversation.title}</span>
              <span>{statusLabel}</span>
            </div>

            <textarea
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                if (saveState !== 'idle') setSaveState('idle');
              }}
              placeholder="ここに下書きを入力"
              className="h-[60vh] min-h-[360px] w-full resize-y rounded-md border border-gray-300 p-3 text-[16px] leading-7 text-gray-900 outline-none focus:border-blue-500"
            />

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>{draftText.length} 文字</span>
              <button
                type="button"
                onClick={() => void saveDraft(draftText)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white active:bg-blue-700"
              >
                今すぐ保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
