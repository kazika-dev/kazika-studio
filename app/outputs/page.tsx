'use client';

import { useState } from 'react';
import OutputList from '@/components/outputs/OutputList';
import OutputFilter from '@/components/outputs/OutputFilter';
import { OutputType } from '@/types/workflow-output';

export default function OutputsPage() {
  const [filterType, setFilterType] = useState<OutputType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            アウトプット一覧
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            ワークフローで生成された画像、動画、音声などのアウトプットを管理します
          </p>
        </div>

        {/* Filter */}
        <OutputFilter
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        {/* Output List */}
        <OutputList filterType={filterType} searchQuery={searchQuery} />
      </div>
    </div>
  );
}
