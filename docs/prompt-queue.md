# プロンプトキュー機能設計書

## 概要

画像生成用のプロンプトと参照画像を選択し、キューとして保存・管理する機能。
ユーザーは事前にプロンプトと画像の組み合わせを準備し、後でまとめて画像生成を実行できる。

## 目的

- 画像生成のプロンプトと参照画像をセットで事前準備できる
- 複数のプロンプトをキューに登録し、順次処理できる
- **キャラクターシート、アウトプット画像、シーンマスタ、小物マスタから参照画像を複数枚選択できる（最大8枚）**
- プロンプトの再利用性を向上させる

---

## データベース設計

### テーブル: `kazikastudio.prompt_queues`

プロンプトキューのメインテーブル

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | BIGSERIAL | NO | 自動採番 | キューID（プライマリキー） |
| user_id | UUID | NO | - | ユーザーID（auth.users参照） |
| name | TEXT | YES | NULL | キュー名（任意の識別名） |
| prompt | TEXT | NO | - | 画像生成プロンプト |
| negative_prompt | TEXT | YES | NULL | ネガティブプロンプト |
| model | TEXT | YES | 'gemini-2.5-flash-image' | 使用するモデル |
| aspect_ratio | TEXT | YES | '16:9' | アスペクト比 |
| priority | INTEGER | NO | 0 | 優先度（高いほど先に処理） |
| status | TEXT | NO | 'pending' | ステータス |
| metadata | JSONB | YES | '{}' | その他のメタデータ |
| error_message | TEXT | YES | NULL | エラーメッセージ（失敗時） |
| output_id | BIGINT | YES | NULL | 生成結果のoutput ID |
| enhance_prompt | TEXT | NO | 'none' | 補完モード（none/enhance） |
| enhanced_prompt | TEXT | YES | NULL | 補完後のプロンプト |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| executed_at | TIMESTAMPTZ | YES | NULL | 実行日時 |

**ステータス値**:
- `pending` - 待機中（未実行）
- `processing` - 処理中
- `completed` - 完了
- `failed` - 失敗
- `cancelled` - キャンセル

**インデックス**:
- `idx_prompt_queues_user_id` ON (user_id)
- `idx_prompt_queues_status` ON (status)
- `idx_prompt_queues_priority_created` ON (priority DESC, created_at ASC)

---

### テーブル: `kazikastudio.prompt_queue_images`

キューに紐づく参照画像（多対多関係）。**1つのキューに対して最大8枚まで**の参照画像を登録可能。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | BIGSERIAL | NO | 自動採番 | ID（プライマリキー） |
| queue_id | BIGINT | NO | - | prompt_queues.id への参照 |
| image_type | TEXT | NO | - | 画像タイプ |
| reference_id | BIGINT | NO | - | 参照先のID |
| display_order | INTEGER | NO | 0 | 表示順序（0〜7） |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |

**image_type 値**:
- `character_sheet` - キャラクターシートからの画像（reference_id = character_sheets.id）
- `output` - アウトプットからの画像（reference_id = workflow_outputs.id）
- `scene` - シーンマスタからの画像（reference_id = m_scenes.id）
- `prop` - 小物マスタからの画像（reference_id = m_props.id）

**複数画像選択の仕様**:
- キャラクターシート、アウトプット、シーンマスタ、小物マスタを**混在して選択可能**
- 合計で**最大8枚**まで選択可能
- `display_order` で画像の優先順位を管理（画像生成時に左から順に配置）
- 同じ画像ソースから複数枚選択可能（例: キャラクターシート2枚 + シーン2枚 + 小物4枚）

**制約**:
- UNIQUE (queue_id, image_type, reference_id) - 同じ画像の重複登録を防止
- FOREIGN KEY (queue_id) REFERENCES prompt_queues(id) ON DELETE CASCADE
- CHECK (display_order >= 0 AND display_order < 8) - 表示順序の範囲制限

**インデックス**:
- `idx_prompt_queue_images_queue_id` ON (queue_id)
- `idx_prompt_queue_images_order` ON (queue_id, display_order)

---

## API設計

### エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/prompt-queue | キュー一覧取得 |
| POST | /api/prompt-queue | キュー追加 |
| GET | /api/prompt-queue/[id] | キュー詳細取得 |
| PUT | /api/prompt-queue/[id] | キュー更新 |
| DELETE | /api/prompt-queue/[id] | キュー削除 |
| POST | /api/prompt-queue/[id]/execute | キュー実行（画像生成） |
| POST | /api/prompt-queue/execute-all | 全pending実行 |

---

### GET /api/prompt-queue

**クエリパラメータ**:
- `status` - ステータスでフィルタ（pending, completed, failed など）
- `limit` - 取得件数（デフォルト: 50）
- `page` - ページ番号（デフォルト: 1）

**レスポンス**:
```json
{
  "success": true,
  "queues": [
    {
      "id": 1,
      "name": "キャラクター立ち絵生成",
      "prompt": "anime girl, standing pose, high quality",
      "negative_prompt": "low quality, blurry",
      "model": "gemini-2.5-flash-image",
      "aspect_ratio": "9:16",
      "priority": 10,
      "status": "pending",
      "images": [
        {
          "id": 1,
          "image_type": "character_sheet",
          "reference_id": 5,
          "display_order": 0,
          "image_url": "https://...",
          "name": "メインキャラクター"
        },
        {
          "id": 2,
          "image_type": "character_sheet",
          "reference_id": 8,
          "display_order": 1,
          "image_url": "https://...",
          "name": "サブキャラクター"
        },
        {
          "id": 3,
          "image_type": "output",
          "reference_id": 123,
          "display_order": 2,
          "image_url": "https://...",
          "name": null
        }
      ],
      "image_count": 3,
      "created_at": "2025-12-22T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

### POST /api/prompt-queue

**リクエストボディ**:
```json
{
  "name": "キャラクター立ち絵生成",
  "prompt": "anime girl, standing pose, high quality",
  "negative_prompt": "low quality, blurry",
  "model": "gemini-2.5-flash-image",
  "aspect_ratio": "9:16",
  "priority": 10,
  "images": [
    {
      "image_type": "character_sheet",
      "reference_id": 5
    },
    {
      "image_type": "character_sheet",
      "reference_id": 8
    },
    {
      "image_type": "output",
      "reference_id": 123
    },
    {
      "image_type": "output",
      "reference_id": 456
    }
  ],
  "metadata": {}
}
```

**バリデーション**:
- `images` 配列は最大8件まで
- 同じ `image_type` + `reference_id` の組み合わせは重複不可
- `display_order` は配列の順序から自動的に設定される（0, 1, 2, ...）

---

### POST /api/prompt-queue/[id]/execute

キュー内の1件を実行して画像生成する。

**処理フロー**:
1. キューのステータスを `processing` に更新
2. 参照画像を取得（キャラクターシート/アウトプットから）
3. Nanobana API を呼び出して画像生成
4. 生成結果を `workflow_outputs` に保存
5. キューのステータスを `completed` に更新、`output_id` を設定
6. 失敗時は `failed` に更新、`error_message` を設定

---

## 画面設計

### 1. キュー一覧ページ (`/prompt-queue`)

**レイアウト**:
```
┌──────────────────────────────────────────────────────┐
│  プロンプトキュー                    [+ 新規作成]    │
├──────────────────────────────────────────────────────┤
│  フィルター: [すべて ▼] [pending ▼] [検索...]       │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │ □ キュー名: キャラクター立ち絵生成             │  │
│  │   プロンプト: anime girl, standing pose...     │  │
│  │   [画像1] [画像2] [画像3]                      │  │
│  │   ステータス: 待機中  優先度: 10               │  │
│  │   [編集] [削除] [実行]                         │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ □ キュー名: 背景生成                           │  │
│  │   ...                                          │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│  [選択した項目を実行] [すべてのpendingを実行]        │
└──────────────────────────────────────────────────────┘
```

**機能**:
- キュー一覧をカード形式で表示
- ステータス、優先度でフィルタ
- 複数選択して一括実行
- ドラッグ&ドロップで優先度変更（オプション）

---

### 2. キュー作成/編集ダイアログ

**レイアウト**:
```
┌──────────────────────────────────────────────────────┐
│  プロンプトキューを作成                    [×]       │
├──────────────────────────────────────────────────────┤
│  キュー名（任意）                                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ キャラクター立ち絵生成                         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  プロンプト *                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ anime girl, standing pose, high quality,       │  │
│  │ detailed, masterpiece                          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ネガティブプロンプト                                │
│  ┌────────────────────────────────────────────────┐  │
│  │ low quality, blurry, bad anatomy               │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  モデル              アスペクト比                    │
│  [gemini-2.5-flash ▼] [16:9 ▼]                      │
│                                                      │
│  優先度                                              │
│  [────────●────────] 5                              │
│                                                      │
│  参照画像（最大8枚）                                 │
│  ┌────────────────────────────────────────────────┐  │
│  │ [キャラクターシートから選択]                   │  │
│  │ [アウトプットから選択]                         │  │
│  │                                                │  │
│  │ 選択済み: 5/8枚                                │  │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │  │
│  │ │画像│ │画像│ │画像│ │画像│ │画像│           │  │
│  │ │ ×  │ │ ×  │ │ ×  │ │ ×  │ │ ×  │           │  │
│  │ └────┘ └────┘ └────┘ └────┘ └────┘           │  │
│  │  CS     CS    Output Output  CS               │  │
│  │ ※ドラッグで順序変更可能                       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│              [キャンセル] [保存]                     │
└──────────────────────────────────────────────────────┘
```

---

### 3. 画像選択ダイアログ

**キャラクターシート選択**:
```
┌──────────────────────────────────────────────────────┐
│  キャラクターシートから選択                  [×]     │
├──────────────────────────────────────────────────────┤
│  現在の選択状況: 3/8枚（キャラクターシート2枚 + アウトプット1枚）│
├──────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │ ☑ │ │ ☑ │ │ □ │ │ □ │ │ □ │               │
│  │ 画像│ │ 画像│ │ 画像│ │ 画像│ │ 画像│               │
│  │    │ │    │ │    │ │    │ │    │               │
│  └────┘ └────┘ └────┘ └────┘ └────┘               │
│  キャラA  キャラB  キャラC  キャラD  キャラE          │
│                                                      │
│  [< 前へ] [1] [2] [3] [次へ >]                       │
│                                                      │
│  ※最大8枚まで選択可能（他の画像と合計）             │
│              [キャンセル] [選択を確定]               │
└──────────────────────────────────────────────────────┘
```

**アウトプット選択**:
```
┌──────────────────────────────────────────────────────┐
│  アウトプットから選択                        [×]     │
├──────────────────────────────────────────────────────┤
│  現在の選択状況: 3/8枚（キャラクターシート2枚 + アウトプット1枚）│
├──────────────────────────────────────────────────────┤
│  フィルター: [画像のみ ▼] [お気に入りのみ □]        │
├──────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │ ☑ │ │ □ │ │ □ │ │ □ │ │ □ │               │
│  │ 画像│ │ 画像│ │ 画像│ │ 画像│ │ 画像│               │
│  │    │ │    │ │    │ │    │ │    │               │
│  └────┘ └────┘ └────┘ └────┘ └────┘               │
│                                                      │
│  [< 前へ] [1] [2] [3] [次へ >]                       │
│                                                      │
│  ※最大8枚まで選択可能（他の画像と合計）             │
│              [キャンセル] [選択を確定]               │
└──────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

```
/app/prompt-queue/
  └── page.tsx                    # キュー一覧ページ

/components/prompt-queue/
  ├── PromptQueueList.tsx         # キュー一覧コンポーネント
  ├── PromptQueueCard.tsx         # キューカード
  ├── PromptQueueDialog.tsx       # 作成/編集ダイアログ
  ├── PromptQueueFilter.tsx       # フィルターコンポーネント
  ├── ImageSelectorDialog.tsx     # 画像選択ダイアログ
  ├── CharacterSheetSelector.tsx  # キャラクターシート選択
  └── OutputSelector.tsx          # アウトプット選択
```

---

## 実装計画

### Phase 1: 基盤構築
1. データベースマイグレーション作成・実行
2. lib/db.ts にヘルパー関数追加
3. 型定義 (types/prompt-queue.ts)

### Phase 2: API実装
1. /api/prompt-queue/route.ts (GET, POST)
2. /api/prompt-queue/[id]/route.ts (GET, PUT, DELETE)
3. /api/prompt-queue/[id]/execute/route.ts (POST)

### Phase 3: UI実装
1. キュー一覧ページ
2. キュー作成/編集ダイアログ
3. 画像選択ダイアログ

### Phase 4: 画像生成連携
1. Nanobana API との連携
2. 結果の保存処理
3. エラーハンドリング

---

## 技術的考慮事項

### 既存機能との統合

- **キャラクターシートAPI** (`/api/character-sheets`): 既存のAPIをそのまま利用
- **アウトプットAPI** (`/api/outputs`): 既存のAPIをそのまま利用
- **シーンマスタAPI** (`/api/scene-masters`): シーン画像の取得に使用
- **小物マスタAPI** (`/api/prop-masters`): 小物画像の取得に使用
- **Nanobana API** (`/api/nanobana`): 画像生成に使用
- **GCP Storage**: 生成画像の保存先

### セキュリティ

- RLSポリシーで所有権チェック
- APIでの認証チェック（Cookie, APIキー, JWT対応）

### パフォーマンス

- キュー一覧取得時に参照画像もJOINで取得
- ページネーション対応
- 画像生成は非同期処理（必要に応じてバックグラウンド処理）

---

## プロンプト補完（Enhance Prompt）機能

### 概要

プロンプトキュー登録時に、Gemini AIを使用してユーザーの入力プロンプトを画像生成に最適化された英語プロンプトに補完する機能。

### データベースカラム

`kazikastudio.prompt_queues` テーブルに以下のカラムが追加されている：

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| enhance_prompt | TEXT | NO | 'none' | 補完モード（`none` または `enhance`） |
| enhanced_prompt | TEXT | YES | NULL | 補完後のプロンプト（補完実行時に保存） |

**enhance_prompt 値の意味**:
- `none` - プロンプト補完を使用しない（通常の `prompt` を使用）
- `enhance` - プロンプト補完を使用する（`enhanced_prompt` を使用）

### データフロー

```
1. ユーザーがプロンプトを入力
   └─> prompt: "笑顔の女の子"

2. 「プロンプトを補完」ボタンをクリック
   └─> Gemini API で英語プロンプトに変換
   └─> enhanced_prompt: "A cheerful anime girl with a bright smile, high quality, detailed, anime style, masterpiece"

3. 「補完後を使用」チェックボックスをON
   └─> enhance_prompt: 'enhance' に設定

4. キュー保存時
   └─> prompt: "笑顔の女の子"（元のプロンプト）
   └─> enhanced_prompt: "A cheerful anime girl..."（補完後）
   └─> enhance_prompt: 'enhance'（補完を使用する）
```

### キュー実行時の処理（重要）

**キューを実行する側では、以下のロジックでプロンプトを決定すること：**

```typescript
// キュー実行時のプロンプト決定ロジック
function getPromptForExecution(queue: PromptQueue): string {
  // enhance_prompt が 'enhance' で enhanced_prompt が存在する場合は
  // enhanced_prompt を使用する
  if (queue.enhance_prompt === 'enhance' && queue.enhanced_prompt) {
    return queue.enhanced_prompt;
  }
  // それ以外は通常の prompt を使用
  return queue.prompt;
}

// 使用例
const promptToUse = getPromptForExecution(queue);
await callNanobanaAPI({
  prompt: promptToUse,
  negativePrompt: queue.negative_prompt,
  model: queue.model,
  aspectRatio: queue.aspect_ratio,
  // ... その他のパラメータ
});
```

### API実装例（POST /api/prompt-queue/[id]/execute）

```typescript
import { getPromptQueueById, updatePromptQueue } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const queueId = parseInt(id, 10);

  // キュー取得
  const queue = await getPromptQueueById(queueId);

  // ステータスを processing に更新
  await updatePromptQueue(queueId, { status: 'processing' });

  try {
    // ★ プロンプト決定（ここがポイント）
    const promptToUse =
      queue.enhance_prompt === 'enhance' && queue.enhanced_prompt
        ? queue.enhanced_prompt  // 補完後プロンプトを使用
        : queue.prompt;          // 元のプロンプトを使用

    // 参照画像を取得
    const images = await getQueueImages(queueId);

    // Nanobana API 呼び出し
    const result = await callNanobanaAPI({
      prompt: promptToUse,
      negativePrompt: queue.negative_prompt,
      model: queue.model || 'gemini-2.5-flash-image',
      aspectRatio: queue.aspect_ratio || '16:9',
      referenceImages: images,
    });

    // 成功時：結果を保存
    await updatePromptQueue(queueId, {
      status: 'completed',
      output_id: result.outputId,
      executed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, output: result });

  } catch (error) {
    // 失敗時：エラーを保存
    await updatePromptQueue(queueId, {
      status: 'failed',
      error_message: error.message,
    });

    return NextResponse.json(
      { error: 'Execution failed', details: error.message },
      { status: 500 }
    );
  }
}
```

### UIでの表示

PromptQueueDialog では以下のようにフィールドが表示される：

1. **プロンプト**（必須）- 元のプロンプト入力欄
2. **[プロンプトを補完]** ボタン - Gemini AIで補完を実行
3. **補完後のプロンプト**（補完実行後に表示）- 補完結果を表示・編集可能
4. **「補完後を使用」** チェックボックス - ONで `enhance_prompt: 'enhance'` に設定

### 補完処理の実装

補完ボタンクリック時の処理（PromptQueueDialog.tsx）:

```typescript
const handleEnhancePrompt = async () => {
  setIsEnhancing(true);
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        prompt: `あなたは画像生成AIのプロンプトエキスパートです。
以下の日本語プロンプトを、高品質な画像生成のための英語プロンプトに変換してください。

入力: ${prompt}

変換ルール:
1. 英語に翻訳
2. 画像生成に適した詳細な描写を追加
3. 品質タグを追加（high quality, detailed, masterpiece など）
4. アニメスタイルの場合は anime style を追加
5. プロンプトのみを出力（説明不要）`,
      }),
    });

    const result = await response.json();
    setEnhancedPrompt(result.text);
    setUseEnhancedPrompt(true);
    setEnhancePrompt('enhance');
  } catch (error) {
    console.error('Enhancement failed:', error);
  } finally {
    setIsEnhancing(false);
  }
};
```

---

## 将来の拡張可能性

- **テンプレート機能**: よく使うプロンプト設定をテンプレートとして保存
- **バッチ処理**: 複数キューを並列処理
- **スケジューリング**: 特定時刻に実行
- **ワークフロー連携**: 生成した画像を次のワークフローに自動入力
