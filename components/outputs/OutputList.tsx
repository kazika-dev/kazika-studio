'use client';

import { useEffect, useState, useCallback } from 'react';
import { WorkflowOutput, OutputType } from '@/types/workflow-output';
import OutputCard from './OutputCard';
import ImageGridSplitDialog from '@/components/prompt-queue/ImageGridSplitDialog';

interface OutputListProps {
  filterType: OutputType | 'all';
  searchQuery: string;
  showFavoritesOnly: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// URLまたはパスに応じて適切なsrcを返す
function getImageUrl(contentUrl: string | undefined): string {
  if (!contentUrl) return '';
  if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
    return contentUrl;
  }
  return `/api/storage/${contentUrl}`;
}

export default function OutputList({ filterType, searchQuery, showFavoritesOnly }: OutputListProps) {
  const [outputs, setOutputs] = useState<WorkflowOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const itemsPerPage = 12;

  // 画像分割ダイアログの状態
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [selectedOutputForSplit, setSelectedOutputForSplit] = useState<WorkflowOutput | null>(null);
  const [savingSplitImages, setSavingSplitImages] = useState(false);

  // フィルター変更時は1ページ目に戻してデータ取得
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery, showFavoritesOnly]);

  // ページまたはフィルターが変更されたらデータを取得
  const fetchOutputs = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('output_type', filterType);
      }
      if (showFavoritesOnly) {
        params.append('favorite_only', 'true');
      }
      params.append('limit', itemsPerPage.toString());
      params.append('page', page.toString());

      const response = await fetch(`/api/outputs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch outputs');
      }

      const data = await response.json();
      setOutputs(data.outputs || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Error fetching outputs:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [filterType, showFavoritesOnly, itemsPerPage]);

  // ページまたはフィルター変更時にデータを取得
  useEffect(() => {
    fetchOutputs(currentPage);
  }, [currentPage, fetchOutputs]);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/outputs?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete output');
      }

      // 削除後、現在のページを再取得（削除で表示件数が減った場合に対応）
      fetchOutputs(currentPage);
    } catch (err) {
      console.error('Error deleting output:', err);
      throw err;
    }
  };

  const handleFavoriteToggle = (id: number, isFavorite: boolean) => {
    // ローカルのoutputs配列を更新
    setOutputs((prev) =>
      prev.map((output) =>
        output.id === id
          ? {
              ...output,
              favorite: isFavorite,
            }
          : output
      )
    );
  };

  // 画像分割ダイアログを開く
  const handleOpenSplitDialog = (output: WorkflowOutput) => {
    setSelectedOutputForSplit(output);
    setSplitDialogOpen(true);
  };

  // 分割画像を保存
  const handleSelectSplitImages = async (images: { dataUrl: string; name: string }[]) => {
    if (images.length === 0) return;

    setSavingSplitImages(true);
    try {
      for (const img of images) {
        // 分割画像をOutputとして保存
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('file', blob, `${img.name}.png`);
        formData.append('prompt', `Split: ${img.name}`);
        formData.append('is_split_image', 'true');
        if (selectedOutputForSplit?.id) {
          formData.append('originalOutputId', selectedOutputForSplit.id.toString());
        }

        await fetch('/api/outputs/save-edited', {
          method: 'POST',
          body: formData,
        });
      }

      // Output一覧を再取得
      await fetchOutputs(currentPage);
    } catch (error) {
      console.error('Failed to save split images:', error);
    } finally {
      setSavingSplitImages(false);
      setSplitDialogOpen(false);
      setSelectedOutputForSplit(null);
    }
  };

  // クライアントサイドフィルタリング（検索クエリのみ、お気に入りはサーバーサイドで処理）
  const filteredOutputs = outputs.filter((output) => {
    // Filter by search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      output.prompt?.toLowerCase().includes(query) ||
      output.content_text?.toLowerCase().includes(query)
    );
  });

  // サーバーサイドページング情報を使用
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  // ページ変更ハンドラー
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          onClick={() => fetchOutputs(currentPage)}
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
      {/* Results count and pagination info */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {total}件のアウトプット
          {totalPages > 1 && (
            <span className="ml-2">
              （ページ {currentPage} / {totalPages}、表示中: {filteredOutputs.length}件）
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredOutputs.map((output) => (
          <OutputCard
            key={output.id}
            output={output}
            onDelete={handleDelete}
            onFavoriteToggle={handleFavoriteToggle}
            onSplit={output.output_type === 'image' ? handleOpenSplitDialog : undefined}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {/* Previous button */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page numbers */}
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // 最初の3ページ、最後の3ページ、または現在のページ周辺のみ表示
              const showPage =
                page <= 3 ||
                page > totalPages - 3 ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              // "..." を表示する位置
              const showEllipsisBefore = page === 4 && currentPage > 5;
              const showEllipsisAfter = page === totalPages - 3 && currentPage < totalPages - 4;

              if (!showPage && !showEllipsisBefore && !showEllipsisAfter) {
                return null;
              }

              if (showEllipsisBefore || showEllipsisAfter) {
                return (
                  <span
                    key={`ellipsis-${page}`}
                    className="px-3 py-2 text-gray-500 dark:text-gray-400"
                  >
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Next button */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* 画像分割ダイアログ */}
      {selectedOutputForSplit && selectedOutputForSplit.content_url && (
        <ImageGridSplitDialog
          open={splitDialogOpen}
          onClose={() => {
            setSplitDialogOpen(false);
            setSelectedOutputForSplit(null);
          }}
          imageUrl={getImageUrl(selectedOutputForSplit.content_url)}
          imageName={selectedOutputForSplit.prompt?.slice(0, 30) || `Output_${selectedOutputForSplit.id}`}
          onSelectSplitImages={handleSelectSplitImages}
          maxSelections={99}
        />
      )}

      {/* 保存中オーバーレイ */}
      {savingSplitImages && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-700 dark:text-gray-300">分割画像を保存中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
