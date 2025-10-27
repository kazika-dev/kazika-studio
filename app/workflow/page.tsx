'use client';

import dynamic from 'next/dynamic';

// WorkflowEditorをクライアントサイドのみでレンダリング
const WorkflowEditor = dynamic(
  () => import('@/components/workflow/WorkflowEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">ワークフローエディタを読み込み中...</p>
        </div>
      </div>
    ),
  }
);

export default function WorkflowPage() {
  return (
    <main className="h-[calc(100vh-64px)] w-full">
      <WorkflowEditor />
    </main>
  );
}
