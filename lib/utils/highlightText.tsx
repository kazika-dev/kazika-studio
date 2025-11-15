import React from 'react';

/**
 * テキスト内の検索クエリをハイライト表示する
 * @param text - ハイライト対象のテキスト
 * @param searchQuery - 検索クエリ
 * @param currentMatchIndex - 現在のマッチインデックス（オレンジ色でハイライト）
 * @returns ハイライトされたReactノードの配列
 */
export function highlightText(
  text: string,
  searchQuery: string,
  currentMatchIndex: number = -1
): React.ReactNode[] {
  if (!searchQuery || !text) {
    return [text];
  }

  // 正規表現の特殊文字をエスケープ
  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  let matchCount = 0;
  const result: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    if (regex.test(part)) {
      const isCurrentMatch = matchCount === currentMatchIndex;
      result.push(
        <mark
          key={`match-${index}`}
          style={{
            backgroundColor: isCurrentMatch ? '#ff9632' : '#ffeb3b',
            color: isCurrentMatch ? '#fff' : '#000',
            fontWeight: isCurrentMatch ? 'bold' : 'normal',
            padding: '0 2px',
            borderRadius: '2px',
          }}
        >
          {part}
        </mark>
      );
      matchCount++;
    } else if (part) {
      result.push(part);
    }
  });

  return result;
}

/**
 * テキスト内のマッチ数をカウント
 * @param text - 検索対象のテキスト
 * @param searchQuery - 検索クエリ
 * @returns マッチ数
 */
export function countMatches(text: string, searchQuery: string): number {
  if (!searchQuery || !text) {
    return 0;
  }

  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedQuery, 'gi');
  const matches = text.match(regex);

  return matches ? matches.length : 0;
}
