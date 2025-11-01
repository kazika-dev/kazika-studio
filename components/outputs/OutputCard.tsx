'use client';

import { WorkflowOutput } from '@/types/workflow-output';
import { useState } from 'react';
import ImageModal from './ImageModal';

interface OutputCardProps {
  output: WorkflowOutput;
  onDelete: (id: number) => void;
}

export default function OutputCard({ output, onDelete }: OutputCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm('このアウトプットを削除してもよろしいですか？')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(output.id);
    } catch (error) {
      console.error('Failed to delete output:', error);
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      text: '📝',
      file: '📎',
      json: '🔧',
    };
    return icons[type] || '📄';
  };

  // URLまたはパスに応じて適切なsrcを返す
  const getImageSrc = (contentUrl: string) => {
    // すでに完全なURL（http/https）の場合はそのまま使用
    if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
      return contentUrl;
    }
    // 内部パスの場合はプロキシ経由
    return `/api/storage/${contentUrl}`;
  };

  const renderContent = () => {
    switch (output.output_type) {
      case 'image':
        return (
          <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {output.content_url && !imageError ? (
              <div
                className="w-full h-full cursor-pointer group"
                onClick={() => setIsImageModalOpen(true)}
              >
                <img
                  src={getImageSrc(output.content_url)}
                  alt={output.prompt || 'Generated image'}
                  className="w-full h-full object-contain transition-transform group-hover:scale-105"
                  loading="lazy"
                  onError={() => {
                    console.error('Image load error:', output.content_url);
                    setImageError(true);
                  }}
                />
                {/* 拡大表示アイコン */}
                <div className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </div>
              </div>
            ) : imageError ? (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <svg className="h-16 w-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">画像の読み込みに失敗しました</p>
                  <p className="text-xs mt-1 text-gray-400">{output.content_url}</p>
                </div>
              </div>
            ) : null}
          </div>
        );

      case 'video':
        return (
          <div className="relative w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {output.content_url && (
              <video
                src={getImageSrc(output.content_url)}
                controls
                className="w-full"
                preload="metadata"
              >
                お使いのブラウザは動画タグをサポートしていません。
              </video>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {output.content_url && (
              <audio src={getImageSrc(output.content_url)} controls className="w-full">
                お使いのブラウザは音声タグをサポートしていません。
              </audio>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
              {output.content_text}
            </pre>
          </div>
        );

      case 'json':
        return (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
              {JSON.stringify(output.metadata, null, 2)}
            </pre>
          </div>
        );

      case 'file':
        return (
          <div className="p-6 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
            <div className="text-6xl mb-4">📎</div>
            {output.content_url && (
              <a
                href={getImageSrc(output.content_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                ファイルを開く
              </a>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden ${
          isDeleting ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* Content */}
        <div className="p-0">{renderContent()}</div>

      {/* Info */}
      <div className="p-4 space-y-3">
        {/* Type Badge */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            <span className="mr-1">{getTypeIcon(output.output_type)}</span>
            {output.output_type}
          </span>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="削除"
          >
            {isDeleting ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Prompt */}
        {output.prompt && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              プロンプト:
            </p>
            <p
              className={`text-sm text-gray-600 dark:text-gray-400 ${
                !showFullPrompt && output.prompt.length > 100 ? 'line-clamp-2' : ''
              }`}
            >
              {output.prompt}
            </p>
            {output.prompt.length > 100 && (
              <button
                onClick={() => setShowFullPrompt(!showFullPrompt)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                {showFullPrompt ? '折りたたむ' : 'もっと見る'}
              </button>
            )}
          </div>
        )}

        {/* Metadata */}
        {output.metadata && Object.keys(output.metadata).length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {Object.entries(output.metadata).slice(0, 3).map(([key, value]) => (
              <div key={key}>
                <span className="font-medium">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        )}

        {/* Date */}
        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          {formatDate(output.created_at)}
        </div>
      </div>
    </div>

    {/* Image Modal */}
    {isImageModalOpen && output.output_type === 'image' && output.content_url && (
      <ImageModal
        imageUrl={getImageSrc(output.content_url)}
        altText={output.prompt || 'Generated image'}
        onClose={() => setIsImageModalOpen(false)}
      />
    )}
    </>
  );
}
