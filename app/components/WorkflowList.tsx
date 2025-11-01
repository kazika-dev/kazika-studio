'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { Pencil, Trash2, Plus, FileText } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function WorkflowList() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ワークフロー一覧を取得
  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflows');
      const data = await response.json();

      if (data.success) {
        setWorkflows(data.workflows);
      } else {
        console.error('Failed to fetch workflows:', data.error);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  // ワークフロー新規作成
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `新規ワークフロー ${new Date().toLocaleString('ja-JP')}`,
          description: '',
          nodes: [
            {
              id: '1',
              type: 'custom',
              position: { x: 250, y: 100 },
              data: {
                label: '入力ノード',
                type: 'input',
                config: {
                  name: '入力ノード1',
                  description: 'データの入力を受け付けます',
                }
              },
            },
          ],
          edges: [],
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 作成したワークフローのIDでリダイレクト
        router.push(`/workflow?id=${data.workflow.id}`);
      } else {
        alert('ワークフローの作成に失敗しました: ' + data.error);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      alert('ワークフローの作成に失敗しました');
      setIsCreating(false);
    }
  };

  // ワークフロー削除
  const handleDelete = async (id: string) => {
    if (!confirm('このワークフローを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows?id=${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        // リストを再取得
        fetchWorkflows();
      } else {
        alert('削除に失敗しました: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('削除に失敗しました');
    }
  };

  // テーブルカラム定義
  const columnHelper = createColumnHelper<Workflow>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'ワークフロー名',
        cell: (info) => (
          <div className="font-medium text-gray-900 dark:text-white">
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('description', {
        header: '説明',
        cell: (info) => (
          <div className="text-gray-600 dark:text-gray-400 max-w-md truncate">
            {info.getValue() || '---'}
          </div>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: '作成日時',
        cell: (info) => (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(info.getValue()).toLocaleString('ja-JP')}
          </div>
        ),
      }),
      columnHelper.accessor('updated_at', {
        header: '更新日時',
        cell: (info) => (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(info.getValue()).toLocaleString('ja-JP')}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'アクション',
        cell: (props) => (
          <div className="flex gap-2">
            <a
              href={`/workflow?id=${props.row.original.id}`}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              title="編集"
            >
              <Pencil size={16} />
            </a>
            <button
              onClick={() => handleDelete(props.row.original.id)}
              className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="削除"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: workflows,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            ワークフロー一覧
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            作成済みのワークフローを管理します
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
          {isCreating ? '作成中...' : '新規作成'}
        </button>
      </div>

      {/* 検索バー */}
      <div className="mb-4">
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="ワークフローを検索..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* テーブル */}
      {workflows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            ワークフローがまだありません
          </p>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            {isCreating ? '作成中...' : '最初のワークフローを作成'}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* フッター */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        {workflows.length > 0 && `合計 ${workflows.length} 件のワークフロー`}
      </div>
    </div>
  );
}
