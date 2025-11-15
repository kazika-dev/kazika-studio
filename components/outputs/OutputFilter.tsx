'use client';

import { OutputType } from '@/types/workflow-output';

interface OutputFilterProps {
  filterType: OutputType | 'all';
  onFilterTypeChange: (type: OutputType | 'all') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (show: boolean) => void;
}

const filterOptions: { value: OutputType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'すべて', icon: '📋' },
  { value: 'image', label: '画像', icon: '🖼️' },
  { value: 'video', label: '動画', icon: '🎬' },
  { value: 'audio', label: '音声', icon: '🎵' },
  { value: 'text', label: 'テキスト', icon: '📝' },
  { value: 'file', label: 'ファイル', icon: '📎' },
  { value: 'json', label: 'JSON', icon: '🔧' },
];

export default function OutputFilter({
  filterType,
  onFilterTypeChange,
  searchQuery,
  onSearchQueryChange,
  showFavoritesOnly,
  onShowFavoritesOnlyChange,
}: OutputFilterProps) {
  return (
    <div className="mb-6 space-y-4">
      {/* Favorites and Search Bar */}
      <div className="flex gap-3">
        {/* Favorites Toggle */}
        <button
          onClick={() => onShowFavoritesOnlyChange(!showFavoritesOnly)}
          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap
            ${
              showFavoritesOnly
                ? 'bg-yellow-500 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-yellow-400'
            }`}
        >
          <span className="mr-2">{showFavoritesOnly ? '⭐' : '☆'}</span>
          お気に入り
        </button>

        {/* Search Bar */}
        <div className="relative flex-1">
        <input
          type="text"
          placeholder="プロンプトで検索..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   placeholder-gray-400 dark:placeholder-gray-500"
        />
        <svg
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        </div>
      </div>

      {/* Type Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterTypeChange(option.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200
              ${
                filterType === option.value
                  ? 'bg-blue-600 text-white shadow-md scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:shadow-sm'
              }`}
          >
            <span className="mr-2">{option.icon}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
