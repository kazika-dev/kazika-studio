'use client';

import { useEffect, useState } from 'react';
import { WorkflowOutput, OutputType } from '@/types/workflow-output';
import OutputCard from './OutputCard';

interface OutputListProps {
  filterType: OutputType | 'all';
  searchQuery: string;
}

export default function OutputList({ filterType, searchQuery }: OutputListProps) {
  const [outputs, setOutputs] = useState<WorkflowOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOutputs();
  }, [filterType]);

  const fetchOutputs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('output_type', filterType);
      }
      params.append('limit', '100');

      const response = await fetch(`/api/outputs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch outputs');
      }

      const data = await response.json();
      setOutputs(data.outputs || []);
    } catch (err) {
      console.error('Error fetching outputs:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/outputs?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete output');
      }

      // Remove from local state
      setOutputs((prev) => prev.filter((output) => output.id !== id));
    } catch (err) {
      console.error('Error deleting output:', err);
      throw err;
    }
  };

  // Filter by search query
  const filteredOutputs = outputs.filter((output) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      output.prompt?.toLowerCase().includes(query) ||
      output.content_text?.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
        <div className="text-red-600 dark:text-red-400 mb-2">
          <svg className="h-12 w-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="font-medium">エラーが発生しました</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <button
          onClick={fetchOutputs}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          再試行
        </button>
      </div>
    );
  }

  if (filteredOutputs.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <svg className="h-24 w-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
          {searchQuery ? '検索結果が見つかりません' : 'アウトプットがありません'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {searchQuery
            ? '別のキーワードで検索してみてください'
            : 'ワークフローを実行してアウトプットを生成しましょう'}
        </p>
        {!searchQuery && (
          <a
            href="/workflow"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ワークフローエディタへ
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {filteredOutputs.length}件のアウトプット
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOutputs.map((output) => (
          <OutputCard key={output.id} output={output} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
