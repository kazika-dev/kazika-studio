# Claude Code 開発メモ

DBへのマイグレーションやdeleteは確認なしで行わないでください。
追加修正したものは `/docs` ディレクトリにまとめてください。


このファイルは、Claude Codeによる開発の履歴と重要なアーキテクチャ情報をまとめたものです。

## ドキュメント

プロジェクトの詳細なドキュメントは `/docs` ディレクトリにあります:

- **[ワークフローノード設定フォームの共通化](/docs/workflow-form-unification.md)** - ノード設定UIの統一アーキテクチャ
- **[ワークフロー設定値のデフォルト値反映機能](/docs/workflow-config-default-values.md)** - ワークフローエディタの設定値を `/form` ページのデフォルト値として反映
- **[会話からスタジオ作成時のワークフロー設定自動化](/docs/conversation-to-studio-workflow.md)** - 会話データからワークフローノード設定を自動生成
- **[Gemini 3 Pro Image Preview モデル対応](/docs/gemini-3-pro-image-preview.md)** - 最新のGemini 3 Pro Image Previewモデルの追加
- **[画像素材マスタ機能](/docs/image-materials-master.md)** - ワークフローで使用する画像素材を管理するマスタ機能

## 最近の主要な変更

### 2025-11-22: 画像素材マスタ機能を追加

**目的**: ワークフローで再利用可能な画像素材（背景、テクスチャ、パーツなど）を管理するマスタ機能を実装

**変更内容**:
- **データベース**: `kazikastudio.m_image_materials` テーブルを作成
  - 素材名、説明、カテゴリ、タグで管理
  - 画像サイズ（width × height）とファイルサイズを自動取得
  - RLSポリシー: 全ユーザー参照可能、認証済みユーザーのみ編集可能

- **バックエンドAPI**:
  - `/api/image-materials` - 一覧取得・新規作成
  - `/api/image-materials/[id]` - 個別取得・更新・削除
  - Sharp ライブラリで画像メタデータを自動取得
  - 署名付きURLを生成して2時間有効なアクセスURLを提供

- **GCP Storage**:
  - `materials/` フォルダに画像を保存
  - ファイル名: `{baseName}-{timestamp}-{randomStr}.{extension}`
  - 対応フォーマット: PNG, JPG, JPEG, WEBP（最大10MB）

- **フロントエンド**:
  - `/components/master/ImageMaterialsManager.tsx` - 管理画面コンポーネント
  - サムネイル付きテーブル表示
  - ドラッグ&ドロップアップロード対応
  - 画像プレビュー表示
  - カテゴリフィルター（背景、キャラクター、テクスチャ、パーツ、その他）
  - タグによる検索機能

- **マスタページ統合**:
  - `/app/master/page.tsx` に画像素材マスタのカードを追加
  - `/app/master/m_image_materials/page.tsx` で管理画面にルーティング

**技術的詳細**:
- 効果音マスタと同じアーキテクチャで実装（一貫性を確保）
- 画像の差し替えは不可（削除→再作成のフロー）
- 編集時はメタデータのみ更新可能
- 削除時はデータベース + GCP Storageの両方から削除

**データフロー**:
1. ユーザーが画像ファイルとメタデータを送信
2. サーバーがファイルタイプ・サイズをバリデーション
3. Sharpで画像のメタデータ（width × height）を取得
4. GCP Storageの `materials/` フォルダにアップロード
5. データベースにメタデータを保存
6. 署名付きURLを生成してレスポンス

**影響範囲**:
- `/master` ページに「画像素材」カードが追加され、素材管理が可能に
- 将来的にワークフローノード（ImageInput, Nanobana, Geminiなど）で素材マスタから画像を選択可能にする予定
- 既存機能への影響なし（完全に独立した新機能）

**ドキュメント**: [/docs/image-materials-master.md](/docs/image-materials-master.md)

---

### 2025-11-22: Gemini 3 Pro モデル対応（画像認識・画像生成）

**目的**: 最新のGemini 3 Proモデルを利用可能にし、画像認識の精度と画像生成の品質を向上

**変更内容（Gemini AI ノード）**:
- `/lib/gemini/constants.ts` を新規作成し、`GEMINI_MODEL_OPTIONS` で利用可能なモデルを一元管理
  - `gemini-3-pro-image-preview` (最新・画像認識)
  - `gemini-2.5-flash` (推奨)
  - `gemini-2.5-pro` (高性能)
  - `gemini-2.0-flash`
- `/lib/workflow/formConfigGenerator.ts` の Gemini ノード設定を更新し、`GEMINI_MODEL_OPTIONS` を使用
- モデル選択は動的に行われるため、`/api/gemini/route.ts` と `/lib/workflow/executor.ts` は変更不要

**変更内容（Nanobana 画像生成ノード）**:
- `/lib/nanobana/constants.ts` を新規作成し、`NANOBANA_MODEL_OPTIONS` で利用可能なモデルを一元管理
  - `gemini-3-pro-image-preview` (Nano Banana Pro - 高品質、最大4K)
  - `gemini-2.5-flash-image` (高速、低コスト、最大1024px)
- `/lib/workflow/formConfigGenerator.ts` の Nanobana ノード設定に `model` フィールドを追加
- `/app/api/nanobana/route.ts` でモデルパラメータを受け取り、動的に使用
- `/lib/workflow/executor.ts` でNanobanaノード実行時にモデル名を送信
- `/components/workflow/UnifiedNodeSettings.tsx` でNanobanaのデフォルトモデルを `gemini-2.5-flash-image` に設定
- `/lib/workflow/migration.ts` で既存のNanobanaノードに `model` フィールドを自動追加

**技術的詳細**:
- ElevenLabs と同じパターンで定数を一元管理し、保守性を向上
- `getNodeTypeConfig()` による一元管理の原則に従い、ワークフローノード設定と `/form` ページの両方に自動反映
- API は動的にモデル名を受け取るため、新しいモデルも自動的に対応
- 既存のNanobanaノードにはマイグレーション処理で `model: 'gemini-2.5-flash-image'` が自動追加される

**影響範囲**:
- **Gemini AI ノード**: 画像認識タスクで最新モデルの高精度な分析が利用可能に
- **Nanobana ノード**: Gemini 3 Pro Image Preview で最大4Kの高品質画像生成が可能に
- 両方のノード設定画面と `/form` ページで新しいモデルが選択可能に
- 既存のワークフローは後方互換性を維持しながら、マイグレーション処理で自動的に更新

---

### 2025-11-18: 会話メッセージの感情タグ再分析機能を追加

**目的**: メッセージを編集した後、会話の文脈から適切なElevenLabs感情タグを再分析して自動的に付け直す機能を追加

**変更内容**:
- **プロンプトビルダー関数** (`/lib/conversation/prompt-builder.ts`):
  - `buildEmotionTagReanalysisPrompt()` - 感情タグ再分析用のAIプロンプトを生成
    - 前の3メッセージをコンテキストとして含める
    - データベースから最新の感情タグリストを取得
    - シチュエーション情報を含める（オプション）
  - `parseEmotionTagReanalysisResponse()` - AIのJSON応答をパースして感情タグと理由を抽出

- **API エンドポイント**:
  - `/api/conversations/messages/[id]/reanalyze-emotion` - 単一メッセージの感情タグを再分析
    - 所有権チェック（conversation → studio/story → user）
    - 前の3メッセージをコンテキストとして取得
    - Gemini AI (gemini-2.0-flash-exp) で感情を分析
    - メッセージテキストの `[emotionTag]` プレフィックスを更新
    - メタデータに `emotionTag`, `emotionTagReason`, `emotionTagUpdatedAt` を保存

  - `/api/conversations/[id]/reanalyze-emotions` - 会話内の全メッセージを一括再分析
    - メッセージを順次処理（レート制限回避のため500ms間隔）
    - 各メッセージに前の3メッセージをコンテキストとして提供
    - 更新成功数とエラー情報を返す

- **UI コンポーネント** (`/components/studio/conversation/ConversationViewer.tsx`):
  - 感情タグ再分析ボタンを追加（`AutoFixHighIcon`）
  - `onReanalyzeEmotion` プロップを追加
  - `reanalyzingId` 状態でどのメッセージを分析中かトラッキング
  - メッセージ編集中に再分析ボタンを表示
  - 保存中または分析中はボタンを無効化

- **ページ統合** (`/app/conversations/page.tsx`):
  - `handleReanalyzeEmotion` ハンドラーを実装
  - APIエンドポイントを呼び出し
  - 成功時にメッセージの状態を更新

**技術的詳細**:
- **コンテキスト認識**: 前の3メッセージと会話の状況説明を使って文脈に応じた感情分析を実現
- **既存タグの削除**: 分析前にメッセージテキストから `[タグ]` を削除し、AI判断にバイアスがかからないようにする
- **データベース駆動**: `kazikastudio.eleven_labs_tags` テーブルから最新の感情タグリストを動的に取得
- **レート制限対策**: 一括再分析では500ms間隔でAPIを呼び出し
- **エラーハンドリング**: 一部のメッセージが失敗しても残りを処理し、エラー情報を返す

**データフロー**:
1. ユーザーがメッセージ編集中に「感情タグを再分析」ボタンをクリック
2. `POST /api/conversations/messages/[id]/reanalyze-emotion` を呼び出し
3. APIが前の3メッセージと会話の状況説明を取得
4. `buildEmotionTagReanalysisPrompt()` で分析用プロンプトを生成
5. Gemini AI が JSON 形式で `{ emotionTag, reason }` を返す
6. メッセージテキストを `[新しいタグ] メッセージ本文` に更新
7. メタデータに分析結果を保存
8. UIに更新されたメッセージを表示

**使用例**:
```typescript
// API呼び出し例
POST /api/conversations/messages/123/reanalyze-emotion

// レスポンス例
{
  "success": true,
  "data": {
    "message": {
      "id": 123,
      "message_text": "[serious] 実は最近、将来のことで悩んでいるんだ...",
      "metadata": {
        "emotionTag": "serious",
        "emotionTagReason": "前のメッセージで楽しい会話をしていたが、急に真剣な話題に切り替わったため",
        "emotionTagUpdatedAt": "2025-11-18T12:34:56Z"
      }
    }
  }
}
```

**影響範囲**:
- メッセージ編集後に感情タグが不適切になった場合、簡単に再分析可能に
- 会話全体の感情タグを一括で見直すことも可能
- ElevenLabs音声生成時の感情表現の品質向上に貢献

---

### 2025-11-18: ストーリー・シーン階層構造による会話管理機能を追加

**目的**: `/conversations` ページに大きなストーリー（大カテゴリ）の中にシーンごとの会話を作成できる階層構造を追加し、より体系的な会話管理を実現する

**変更内容**:
- **データベースマイグレーション** (`supabase/migrations/20251118000001_create_stories_and_scenes.sql`):
  - `kazikastudio.stories` テーブルを作成（ストーリー全体を管理）
  - `kazikastudio.story_scenes` テーブルを作成（ストーリー内のシーンを管理、`sequence_order` で順序管理）
  - `kazikastudio.conversations` テーブルに `story_scene_id` カラムを追加（NULL許可、既存データとの互換性維持）
  - `conversations.studio_id` を NULL 許可に変更（ストーリー機能と共存）
  - RLS ポリシーを更新し、`studio_id` と `story_scene_id` の両方に対応

- **型定義** (`/types/conversation.ts`):
  - `Story`, `StoryScene`, `StoryTreeNode` インターフェースを追加
  - `Conversation` に `story_scene_id` フィールドを追加（`studio_id` と両方 NULL 許可）
  - `GenerateConversationRequest` に `storySceneId` フィールドを追加
  - Story/Scene 用の API Request/Response 型を追加

- **データベース関数** (`/lib/db.ts`):
  - `getStoriesByUserId()`, `getStoryById()`, `createStory()`, `updateStory()`, `deleteStory()`
  - `getScenesByStoryId()`, `getSceneById()`, `createStoryScene()`, `updateStoryScene()`, `deleteStoryScene()`
  - `getConversationsBySceneId()` - シーン内の会話一覧を取得
  - `getStoriesTreeByUserId()` - ユーザーの全ストーリー・シーン・会話の階層構造を取得

- **API エンドポイント**:
  - `/api/stories` - ストーリーの作成・一覧取得
  - `/api/stories/[id]` - ストーリーの取得・更新・削除
  - `/api/stories/[id]/scenes` - シーンの作成・一覧取得
  - `/api/scenes/[id]` - シーンの取得・更新・削除
  - `/api/stories/tree` - ストーリー階層構造の一括取得
  - `/api/conversations/generate` - `storySceneId` パラメータに対応

- **UI コンポーネント**:
  - `StoryCreationDialog.tsx` - ストーリー作成ダイアログ
  - `SceneCreationDialog.tsx` - シーン作成ダイアログ
  - `StoryTreeView.tsx` - ストーリー・シーン・会話のツリー表示コンポーネント
  - `ConversationGeneratorDialogWithScene.tsx` - シーン内での会話生成ダイアログ
  - `/app/conversations/page.tsx` を完全リニューアル（階層構造表示）

**UI 構造**:
```
/conversations ページ
├── 左サイドバー: ストーリーツリー表示
│   ├── 📚 ストーリーA
│   │   ├── 🎬 シーン1
│   │   │   ├── 💬 会話1
│   │   │   └── 💬 会話2
│   │   └── 🎬 シーン2
│   │       └── 💬 会話3
│   └── 📚 ストーリーB
│       └── ...
└── 右側: 会話表示エリア（選択した会話のメッセージを表示）
```

**データフロー**:
1. ユーザーが「新しいストーリー」を作成 → `POST /api/stories`
2. ストーリー内に「シーンを追加」 → `POST /api/stories/[id]/scenes`
3. シーン内で「会話を追加」をクリック → `ConversationGeneratorDialogWithScene` が開く
4. 会話生成時に `storySceneId` を含めて送信 → `POST /api/conversations/generate`
5. `conversations` テーブルに `story_scene_id` 付きで保存
6. `/api/stories/tree` で階層構造を取得してツリー表示

**技術的詳細**:
- **後方互換性を完全維持**: `conversations.studio_id` と `conversations.story_scene_id` の両方を NULL 許可にし、既存のスタジオベースの会話も引き続き動作
- **RLS ポリシーの OR 条件**: `studio_id` と `story_scene_id` のどちらかで所有権チェックを行う
- **Cascade 削除**: ストーリーを削除すると、関連するシーン・会話も自動削除される（`ON DELETE CASCADE`）
- **sequence_order 自動採番**: シーン作成時に `sequence_order` が省略された場合、自動的に最後に追加される

**影響範囲**:
- `/conversations` ページが階層構造表示に完全移行
- 既存のスタジオベースの会話は影響を受けず、引き続き `/studios/[id]/conversation` で利用可能
- 会話生成APIが `studioId` と `storySceneId` の両方に対応（少なくとも一方が必須）

---

### 2025-11-16: nodeOverrides適用順序の修正（scene_prompt_en がNanobanaに正しく設定されるように）

**目的**: スタジオのワークフローステップ実行時に、`input_config.nodeOverrides` の設定が他の入力処理で上書きされないようにする

**問題**:
- `/app/api/studios/steps/[id]/execute/route.ts` の `applyInputsToNodes()` で、`nodeOverrides` を関数の最初に適用していたため、その後の処理（`inputs.prompt`, `inputs.workflowInputs`）で上書きされる可能性があった
- 特に Nanobana ノードの `prompt` が `scene_prompt_en` で設定されても、後続の処理で空になる問題があった

**修正内容**:
- `applyInputsToNodes()` で `nodeOverrides` の適用を**関数の最後**に移動（789-807行目）
- これにより、`nodeOverrides` の値が最優先で適用され、他の処理で上書きされないことを保証

**技術的詳細**:
```typescript
// Before: nodeOverrides を最初に適用 → 後続の処理で上書きされる可能性
async function applyInputsToNodes(nodes, inputs, workflow, step) {
  // 1. nodeOverrides を適用
  // 2. inputs.prompt で上書き
  // 3. inputs.workflowInputs で追加/上書き
}

// After: nodeOverrides を最後に適用 → 確実に反映される
async function applyInputsToNodes(nodes, inputs, workflow, step) {
  // 1. inputs.prompt を適用
  // 2. inputs.workflowInputs を適用
  // 3. nodeOverrides を適用（最優先）← ここで確定
}
```

**影響範囲**:
- 会話からスタジオを作成した場合、`scene_prompt_en` が Nanobana ノードに**確実に**設定される
- その他の `nodeOverrides` の設定（`voiceId`, `aspectRatio`, `selectedCharacterSheetIds` など）も確実に反映される
- `/docs/conversation-to-studio-workflow.md` に詳細を追記

---

### 2025-11-16: 会話からスタジオ作成時のワークフロー設定自動化

**目的**: 会話データからスタジオを作成する際、ワークフローノード（ElevenLabs、Nanobana）の設定を会話データから自動的に生成し、手作業を削減する

**変更内容**:
- `/app/api/conversations/[id]/create-studio/route.ts` でNanobanaノードの `nodeOverrides` 生成を追加
- ElevenLabsノードに `modelId` の設定を追加（デフォルト: `eleven_turbo_v2_5`）
- Nanobanaノードに以下の設定を自動生成：
  - `prompt`: `scene_prompt_en` → `scene_prompt_ja` → `metadata.scene` の優先順位で自動設定
  - `aspectRatio`: ワークフローノードの既存設定を継承（デフォルト: `16:9`）
  - `selectedCharacterSheetIds`: `character_id` からキャラクター画像を自動設定

**技術的詳細**:
- **データフロー**:
  1. 会話生成時に `conversation_messages` テーブルに保存された `scene_prompt_en`, `scene_prompt_ja`, `character_id` を取得
  2. スタジオ作成時に `studio_board_workflow_steps.input_config.nodeOverrides` に設定を格納
  3. ワークフロー実行時（`/api/workflows/execute`）に `nodeOverrides` が `node.data.config` にマージされる
- **CLAUDE.mdの原則との整合性**:
  - `nodeOverrides` は `node.data.config` にマージされるため、既存のノード設定システムと完全に互換性がある
  - `getNodeTypeConfig()` で定義されたフィールドがそのまま使用される
- **後方互換性**:
  - `nodeOverrides` が存在しない場合は、ワークフローノードの既存設定がそのまま使用される

**使用例**:
```typescript
// 会話メッセージ
{
  "message_text": "[friendly] こんにちは！",
  "scene_prompt_en": "school rooftop at daytime, anime style...",
  "character_id": 1
}

// 生成される nodeOverrides
{
  "elevenlabs-1": {
    "text": "[friendly] こんにちは！",
    "voiceId": "ja-JP-Wavenet-A",
    "modelId": "eleven_turbo_v2_5"
  },
  "nanobana-1": {
    "prompt": "school rooftop at daytime, anime style...",
    "aspectRatio": "16:9",
    "selectedCharacterSheetIds": [1]
  }
}
```

**影響範囲**:
- 会話からスタジオを作成した時点で、すべてのノード設定が自動的に完了
- ユーザーは `/form` ページで個別にカスタマイズ可能（`nodeOverrides` は上書きされる）
- `/docs/conversation-to-studio-workflow.md` に詳細なドキュメントを追加

---

### 2025-11-16: 会話生成機能に感情タグ、カメラ情報、シーンプロンプトを追加

**目的**: 会話生成時に感情タグ（ElevenLabs用）とカメラアングル・ショット距離を自動設定し、各メッセージに日本語・英語のシーンプロンプトを生成して画像生成を容易にする

**変更内容**:
- `/lib/db.ts` にカメラアングル・ショット距離・感情タグ取得関数を追加（`getAllCameraAngles`, `getAllShotDistances`, `getAllElevenLabsTags`, `getRandomCameraAngle`, `getRandomShotDistance`）
- `/lib/conversation/prompt-builder.ts` の `buildConversationPrompt()` を**async化**し、データベースから最新の感情タグを自動取得してプロンプトに含める
- `/lib/conversation/prompt-builder.ts` の `buildConversationPrompt()` にシーンプロンプト生成の指示を追加（日本語・英語の両方）
- `/lib/conversation/prompt-builder.ts` の `buildScenePrompt()` を**async化**し、データベースから最新のカメラアングル・ショット距離を自動取得してプロンプトに含める
- `/types/conversation.ts` の `GeneratedMessage` に `scenePromptJa`, `scenePromptEn` フィールドを追加
- `/types/conversation.ts` の `ConversationMessage` に `scene_prompt_ja`, `scene_prompt_en` カラムを追加
- `/app/api/conversations/generate/route.ts` でメッセージ保存時に `[emotionTag]` プレフィックスを自動追加（例: `[friendly] こんにちは！`）
- `/app/api/conversations/generate/route.ts` でメッセージ保存時に `scene_prompt_ja`, `scene_prompt_en` をデータベースカラムに保存
- `/app/api/conversations/generate/route.ts` でシーン生成時にカメラ情報を取得し、プロンプトと metadata に保存

**技術的詳細**:
- **感情タグ機能（データベース駆動）**:
  - `buildConversationPrompt()` が呼び出されるたびに `kazikastudio.eleven_labs_tags` テーブルから**最新の感情タグ**を取得
  - マスターテーブルに新しい感情タグを追加すると、次回の会話生成から**自動的に反映**される
  - AIが取得した感情タグのリストから、会話の文脈に応じて各メッセージに適切な感情タグを自動選択
  - メッセージテキストに `[タグ名]` 形式でプレフィックスとして追加され、ElevenLabs音声生成時に使用される
  - メタデータにも `emotionTag` として保存され、後から参照可能

- **シーンプロンプト機能（日本語・英語）**:
  - AIが各メッセージごとに画像生成用のプロンプトを**日本語と英語の両方**で生成
  - **日本語プロンプト（`scenePromptJa`）**: 100-150文字程度で、場所・時間帯・キャラクターの配置・表情・雰囲気を詳細に描写
  - **英語プロンプト（`scenePromptEn`）**: Stable Diffusion/DALL-E形式で、high quality, detailed, anime styleなどの品質タグを含む
  - `conversation_messages` テーブルの `scene_prompt_ja` と `scene_prompt_en` カラムに保存
  - metadataではなく専用カラムに保存することで、検索・フィルタリングが容易に

- **カメラ情報機能（データベース駆動）**:
  - `buildScenePrompt()` が呼び出されるたびに `kazikastudio.m_camera_angles` と `kazikastudio.m_shot_distances` テーブルから**最新のカメラ情報**を取得
  - マスターテーブルに新しいカメラアングルやショット距離を追加すると、次回のシーン生成から**自動的に反映**される
  - **会話全体の最初のシーン**: AIが取得したカメラ情報のリストから、会話の内容に応じて適切なカメラアングルとショット距離を選択
  - **メッセージグループごとのシーン**: ランダムなカメラアングルとショット距離を割り当てて、シーンにバリエーションを追加
  - 選択されたカメラ情報は画像生成プロンプトに含まれ（例: "from low angle, medium close-up shot"）、metadata にも保存

**データフロー**:
1. ユーザーが会話生成をリクエスト（キャラクター、シチュエーション、メッセージ数）
2. `buildConversationPrompt()` が `kazikastudio.eleven_labs_tags` から**最新の感情タグリスト**を取得
3. プロンプトに感情タグリストとシーンプロンプト生成指示を含めてGemini AIに送信
4. Gemini AIが各メッセージに `emotionTag`, `scenePromptJa`, `scenePromptEn` を付けて会話を生成
5. メッセージ保存時に：
   - `[emotionTag]` をテキストの先頭に追加
   - `scenePromptJa` を `conversation_messages.scene_prompt_ja` に保存
   - `scenePromptEn` を `conversation_messages.scene_prompt_en` に保存
6. `buildScenePrompt()` が `kazikastudio.m_camera_angles` と `kazikastudio.m_shot_distances` から**最新のカメラ情報**を取得
7. プロンプトにカメラ情報リストを含めてGemini AIに送信
8. 最初のシーンはAIがカメラ情報リストから適切なものを選択、その他のシーンはランダムに割り当て
9. シーンプロンプトにカメラ情報を含めて保存

**影響範囲**:
- 会話生成時に感情タグが自動的に設定され、ElevenLabs音声生成で感情表現が可能に
- シーン生成時にカメラ情報が自動的に設定され、より映像的な画像生成プロンプトが作成される
- **マスターテーブルの変更が即座に反映**: `/app/master` ページで感情タグやカメラ情報を追加・編集すると、次回の会話生成から自動的に利用可能になる
- 既存の会話データには影響なし（後方互換性を維持）
- `/docs/conversation-generation-enhancements.md` に詳細なドキュメントを追加

**使用例**:
```json
// メッセージ生成例
{
  "speaker": "主人公",
  "message": "実は最近、将来のことで悩んでいるんだ...",
  "emotion": "sad",
  "emotionTag": "serious",
  "scene": "主人公は柵に寄りかかり、遠くを見つめながら話す",
  "scenePromptJa": "夕暮れ時の学校の屋上。主人公が柵に寄りかかり、遠くを見つめている。オレンジ色の空が背景に広がり、穏やかな風が吹いている。真剣な表情で将来について考えている。",
  "scenePromptEn": "rooftop scene at sunset, male student leaning on fence, looking into distance, orange sky background, gentle breeze, serious expression thinking about future, anime style, high quality, detailed, cinematic lighting"
}

// データベース保存
{
  "message_text": "[serious] 実は最近、将来のことで悩んでいるんだ...",
  "scene_prompt_ja": "夕暮れ時の学校の屋上。主人公が柵に寄りかかり、遠くを見つめている。オレンジ色の空が背景に広がり、穏やかな風が吹いている。真剣な表情で将来について考えている。",
  "scene_prompt_en": "rooftop scene at sunset, male student leaning on fence, looking into distance, orange sky background, gentle breeze, serious expression thinking about future, anime style, high quality, detailed, cinematic lighting"
}

// シーン生成例
{
  "sceneDescription": "夕暮れ時の学校の屋上。主人公は柵に寄りかかり...",
  "imagePrompt": "rooftop scene at sunset, from low angle, medium close-up shot, anime style",
  "cameraAngle": "ローアングル",
  "shotDistance": "ミディアムクローズアップ"
}
```

---

### 2025-11-16: Seedream4ノードにOutput画像選択機能を追加

**目的**: Seedream4ノードでWorkflow Outputsテーブルから生成済み画像を選択できるようにし、既存の画像を動画生成の参照として再利用可能にする

**変更内容**:
- `/lib/workflow/formConfigGenerator.ts` のSeedream4ケースに `selectedOutputIds` フィールドを追加（Nanobanaと同じパターン）
- `/components/workflow/Seedream4Node.tsx` にOutput画像用の接続ハンドル4つを追加（紫色、ID: `output-0` ～ `output-3`）
- ノードの高さを `minHeight: 320` → `440` に調整（13個の接続ハンドルが表示されるように）
- `/lib/workflow/executor.ts` のSeedream4ケースにOutput画像読み込み処理を追加（キャラクターシート、参照画像、Output画像の順で最大8枚まで）
- `/lib/workflow/migration.ts` のマイグレーション処理に `seedream4` を追加（既存ノードに `selectedOutputIds: []` を自動追加）
- `/lib/workflow/formConfigGenerator.ts` の `extractFormFieldsFromNodes()` で `outputSelector` のデフォルト値を配列に設定

**技術的詳細**:
- CLAUDE.mdの原則に従い、`getNodeTypeConfig()` で一元管理
- Nanobanaノードと同じパターンで実装し、コードの一貫性を確保
- `UnifiedNodeSettings.tsx` の既存のデフォルト値ロジックにより、`outputSelector` が自動的に `[]` で初期化される（103-105行目）
- **画像読み込み処理（executor.ts）**:
  1. キャラクターシートID → `character_sheets` テーブル → GCP Storage (最大4枚)
  2. 参照画像パス (`referenceImagePaths`) → GCP Storage (最大4枚)
  3. Output画像ID (`selectedOutputIds`) → `workflow_outputs` テーブル → GCP Storage (最大4枚)
  4. 前のノードから接続された画像を追加（`storagePath`）
  5. 最大8枚までの制限を適用

**接続ハンドル（左側）**:
1. **プロンプト入力** (緑色) - ID: `prompt`
2. **キャラクターシート1〜4** (青色) - ID: `character-0` ～ `character-3`
3. **参照画像1〜4** (オレンジ色) - ID: `image-0` ～ `image-3`
4. **Output画像1〜4** (紫色) - ID: `output-0` ～ `output-3`

**影響範囲**:
- `getNodeTypeConfig()` の定義により、**ワークフローノード設定と `/form` ページの両方に自動反映**
- Seedream4ノードで過去に生成された画像を動画生成の参照として使用可能に
- 既存のSeedream4ノードを開くと、マイグレーションにより自動的に `selectedOutputIds: []` が追加される

---

### 2025-11-16: 既存ノードの後方互換性を保つマイグレーション機能を実装

**目的**: 既存のワークフローノード（Nanobana, Gemini）に新しく追加された `selectedOutputIds` フィールドが自動的に追加されるようにする

**問題**:
- `selectedOutputIds` フィールドは後から追加されたため、既存のNanobana/Geminiノードには含まれていない
- そのため、Output画像選択機能が正しく動作しない（`node.data.config.selectedOutputIds` が `undefined`）

**変更内容**:
- `/lib/workflow/migration.ts` に共通のマイグレーション関数 `migrateNodeConfig()` を作成
- `/app/api/workflows/execute-draft/route.ts` で実行前にマイグレーションを適用
- `/app/api/workflows/execute/route.ts` で `/form` ページからの inputs を node.data.config にマージする処理を追加
- `/components/workflow/WorkflowEditor.tsx` でワークフロード込み時にマイグレーションを適用
- Nanobana/Geminiノードで `config.selectedOutputIds === undefined` の場合、`selectedOutputIds: []` を追加
- デバッグログを追加して、マイグレーションの実行を確認可能に

**技術的詳細**:
- マイグレーション関数を `/lib/workflow/migration.ts` で一元管理
- **API側（`execute-draft/route.ts`）で実行前に自動的にマイグレーションを適用** ← これが重要！
- **`/form` ページからの実行時**: `execute/route.ts` で inputs の `selectedOutputIds`, `aspectRatio`, `model` などを `node.data.config` にマージ
- WorkflowEditor では `loadWorkflow()` 内でノードを `setNodes()` する前に `migrateNodeConfig()` を呼び出す
- URLパラメータからの読み込みと最新ワークフローの読み込み、両方に適用

**影響範囲**:
- 既存のワークフローを開いたときに、自動的に `selectedOutputIds: []` が追加される
- ワークフローを保存すると、マイグレーション後の状態が保存される
- Output画像選択機能が既存のノードでも正しく動作するようになる

**デバッグログ**:
- `/components/form/DynamicFormField.tsx` の `outputSelector` に選択/削除時のログを追加
- `/components/workflow/UnifiedNodeSettings.tsx` に初期化・変更・保存時のログを追加
- `/lib/workflow/executor.ts` のNanobana/Geminiケースに `node.data.config` と `selectedOutputIds` の詳細ログを追加

---

### 2025-11-16: Geminiノードに画像処理機能を追加（キャラクターシート・参照画像・Output画像対応）

**目的**: Gemini AIノードでマルチモーダル機能を活用し、キャラクターシート・参照画像・Output画像を使った画像認識を可能にする

**変更内容**:
- `/lib/workflow/formConfigGenerator.ts` のGeminiケースに3つのフィールドを追加：
  - `selectedCharacterSheetIds` (キャラクターシート、最大4つ)
  - `referenceImages` (参照画像、最大4つ)
  - `selectedOutputIds` (Output画像選択、最大4つ)
- `/components/workflow/GeminiNode.tsx` に接続ハンドルを追加（プロンプト×1、キャラクターシート×4、参照画像×4）
- ノードの `minHeight: 320` に設定し、全13個の接続ハンドル（プロンプト1 + キャラシート4 + 画像4 + Output画像4）が表示されるように調整
- **`/lib/workflow/executor.ts` のGeminiケースに画像読み込み処理を追加**（326-453行目）

**技術的詳細**:
- **CLAUDE.mdの原則に従い、`getNodeTypeConfig()`で一元管理**
- Nanobanaノードと同じパターンで実装し、コードの一貫性を確保
- `UnifiedNodeSettings.tsx` の既存のデフォルト値ロジック（100-105行目）により、配列フィールドが自動的に `[]` で初期化される
- **画像読み込み処理（executor.ts）**:
  1. キャラクターシートIDから `character_sheets` テーブルを検索し、GCP Storageから画像を取得してbase64に変換
  2. 参照画像パス (`referenceImagePaths`) からGCP Storageの画像を取得してbase64に変換
  3. Output画像ID (`selectedOutputIds`) から `workflow_outputs` テーブルを検索し、GCP Storageから画像を取得してbase64に変換
  4. 前のノードから接続された画像を追加（`extractImagesFromInput`）
  5. 最大4枚までの制限を各段階で適用

**接続ハンドル（左側）**:
1. **プロンプト入力** (緑色) - ID: `prompt`
2. **キャラクターシート1〜4** (青色) - ID: `character-0` 〜 `character-3`
3. **参照画像1〜4** (オレンジ色) - ID: `image-0` 〜 `image-3`

**影響範囲**:
- `getNodeTypeConfig()` の定義により、**ワークフローノード設定と `/form` ページの両方に自動反映**
- Geminiノードで画像認識が可能になり、キャラクターの表情分析、画像の説明生成などが実現可能に
- `/form` ページでも自動的に3つのフィールドが表示される（一元管理の恩恵）
- **Output画像選択で選んだ画像がbase64形式でGemini APIに正しく送信される**

### 2025-11-16: ワークフロー設定値を `/form` ページのデフォルト値として反映

**目的**: ワークフローエディタで設定した値（アスペクト比、プロンプトなど）が、`/app/form` ページを開いたときにデフォルト値として自動的に入力されるようにする

**変更内容**:
- `/lib/workflow/formConfigGenerator.ts` の `extractFormFieldsFromNodes()` を修正し、`node.data.config` から設定値を取得して `defaultValue` として保存
- `/components/form/DynamicFormField.tsx` の `FormFieldConfig` に `defaultValue?: any` を追加
- `/app/form/page.tsx` で `defaultValue` が設定されている場合はそれを初期値として使用するように修正
- 全ノードタイプ（Gemini, Nanobana, Higgsfield, Seedream4, ElevenLabs）に対応

**技術的詳細**:
- ワークフローエディタで「アスペクト比: 16:9」「プロンプト: "a cat"」と設定 → `node.data.config` に保存
- ワークフロー保存時に `generateFormConfig()` が `form_config.fields` に `defaultValue` を含める
- `/form` ページ読み込み時に `defaultValue` を初期値として使用
- 後方互換性を維持（`defaultValue` がない場合は空の値を使用）

**影響範囲**:
- ワークフローをテンプレートとして使いやすくなった
- ユーザーが毎回同じ値を入力する手間が省ける
- 一元化されたアーキテクチャ（`getNodeTypeConfig()`）により、1箇所の修正で両方に反映される

**詳細**: [workflow-config-default-values.md](/docs/workflow-config-default-values.md)

### 2025-11-16: Nanobanaノード設定にOutput画像選択フォームを追加（複数選択対応）

**目的**: Workflow Outputsテーブルから生成済み画像を選択できるようにし、既存の画像を再利用可能にする

**変更内容**:
- `/components/form/DynamicFormField.tsx` に `outputSelector` フィールドタイプを追加
- `/api/outputs` から画像タイプのoutputを取得し、ポップアップダイアログで表示
- Nanobanaノード設定に `selectedOutputIds` フィールドを追加（`getNodeTypeConfig()` で一元管理）
- `/components/workflow/UnifiedNodeSettings.tsx` で `outputSelector` のデフォルト値を配列に設定
- `/app/api/outputs/route.ts` を実際のテーブルスキーマ (`content_url`) に合わせて修正
- `/lib/workflow/executor.ts` でselectedOutputIdsから画像を取得してNanobana APIに送信
- `/lib/db.ts` に `getWorkflowOutputById` 関数を追加

**技術的詳細**:
- CLAUDE.mdの原則に従い、`getNodeTypeConfig()` で1箇所定義することで、ワークフローノード設定と `/form` ページの両方で自動的に利用可能
- **複数選択対応**: Checkboxで最大4枚まで選択可能（`maxSelections: 4`）
- ポップアップダイアログで5枚ずつページング表示（前へ/次へボタン）
- 選択済み画像はグリッド形式でプレビュー表示（×ボタンで削除可能）
- ダイアログを開いた時のみAPIを呼び出し（パフォーマンス向上）
- 実際のテーブルスキーマ (`content_url`, `content_text`) に合わせてAPIを修正
- 最大数に達した場合は、未選択の画像が半透明で無効化表示
- **Nanobana API連携**: selectedOutputIdsからworkflow_outputsテーブルを検索し、GCP Storageから画像を取得してbase64に変換、Nanobana APIに送信

**UI/UX**:
- ボタンテキスト: 「画像を選択 (最大4枚)」「画像を変更 (2/4)」など、状態に応じて変化
- ダイアログヘッダーに「2/4枚選択中」のカウンター表示
- 選択済み画像は80x80のサムネイルでグリッド表示、右上に削除ボタン
- 画像カードをクリックでトグル選択、Checkboxで選択状態を視覚的に表示

**影響範囲**:
- Nanobanaノード設定画面に新しいフィールドが追加され、過去の生成画像を最大4枚まで選択可能に
- `/form` ページでも自動的に表示される（一元管理の恩恵）
- `workflow_outputs` テーブルから画像データを正しく取得できるようになった

**コミット**:
- `33bbedf` - "Nanobanaノード設定にoutput画像選択フォームを追加"
- `aaf7aa3` - "OutputSelectorでcontent_urlフィールドに対応"
- `d79b997` - "workflow_outputsテーブルスキーマに合わせてAPI修正"
- `8f638a3` - "workflow_outputs APIからstep_id/node_idを削除" (マイグレーション未適用のため)
- `d45a0e8` - "実際のテーブルスキーマ(content_url)に合わせて修正"
- `cdb9f50` - "Output画像選択をポップアップ+ページング表示に変更" (5枚ずつページング)
- `6269479` - "Output画像選択を最大4枚の複数選択に対応"
- `99a7790` - "selectedOutputIdsをNanobana APIに送信する処理を追加"

### 2025-01-16: Seedream4ノードの完全実装（キャラクターシート・参照画像対応）

**目的**: Seedream4ノードにキャラクターシート4枚と参照画像4枚までの登録機能を追加し、ワークフローエディタでの接続を可視化

**変更内容**:
- `/lib/workflow/formConfigGenerator.ts` に `seedream4` ケースを追加し、一元管理を実装
- `/components/workflow/Seedream4NodeSettings.tsx` を `UnifiedNodeSettings` を使用するように簡素化（約380行 → 約27行、93%削減）
- `/components/workflow/Seedream4Node.tsx` に接続ハンドルを追加（プロンプト×1、キャラクターシート×4、参照画像×4）
- `/components/workflow/UnifiedNodeSettings.tsx` にSeedream4のデフォルト値を追加

**技術的詳細**:
- Nanobanaノードと同じパターンで実装し、コードの一貫性を確保
- アイコンを `ImageSearchIcon` → `VideoLibraryIcon` に変更（動画生成であることを明示）
- ノードの `minHeight: 320` に設定し、全9個の接続ハンドルが表示されるように調整

**接続ハンドル（左側）**:
1. **プロンプト入力** (緑色) - ID: `prompt`
2. **キャラクターシート1〜4** (青色) - ID: `character-0` 〜 `character-3`
3. **参照画像1〜4** (オレンジ色) - ID: `image-0` 〜 `image-3`

**フォーム設定フィールド**:
- プロンプト（textarea）
- アスペクト比（select、デフォルト: 4:3）
- 品質（select、Basic/High）
- キャラクターシート選択（最大4つ）
- 参照画像アップロード（最大4つ、各5MB以下）

**影響範囲**:
- `getNodeTypeConfig()` の定義により、ワークフローノード設定と `/form` ページの両方に自動反映
- Seedream4ノードで一元管理の原則が徹底され、保守性が向上

### 2025-01-16: ノード設定の完全な一元化（`getNodeTypeConfig()` → `/form` への自動反映）

**目的**: `getNodeTypeConfig()` と `extractFormFieldsFromNodes()` の重複を解消し、1箇所の修正で「ワークフローノード設定」と「`/form` ページ」の両方に反映されるようにする

**変更内容**:
- `/lib/workflow/formConfigGenerator.ts` の `extractFormFieldsFromNodes()` を修正し、`getNodeTypeConfig()` から設定を取得するように変更
- ElevenLabs、Gemini、Nanobana、Higgsfield ノードで一元化を実装
- `/lib/elevenlabs/constants.ts` に `ELEVENLABS_MODEL_OPTIONS` を追加し、v3 モデルを含む全モデルを両方の UI で利用可能に

**技術的詳細**:
- 従来は `getNodeTypeConfig()` と `extractFormFieldsFromNodes()` で同じノードの設定を2箇所で定義していた（重複）
- `extractFormFieldsFromNodes()` が `getNodeTypeConfig()` を呼び出すように修正し、設定を再利用
- これにより、`getNodeTypeConfig()` の定義を修正すれば自動的に `/form` にも反映される

**具体例（ElevenLabs ノード）**:
```typescript
// Before: 2箇所で定義（重複）
// getNodeTypeConfig() で定義
case 'elevenlabs': return { fields: [...] };
// extractFormFieldsFromNodes() でも定義（重複！）
if (nodeType === 'elevenlabs') { fields.push(...); }

// After: 1箇所で定義、自動的に両方に反映
// getNodeTypeConfig() で定義（1箇所のみ）
case 'elevenlabs': return { fields: [...] };
// extractFormFieldsFromNodes() は getNodeTypeConfig() を呼び出すだけ
if (nodeType === 'elevenlabs') {
  const nodeConfig = getNodeTypeConfig('elevenlabs');
  nodeConfig.fields.forEach(field => fields.push({...field}));
}
```

**影響範囲**:
- ElevenLabs の v3 モデルが「ワークフローノード設定」と「`/form` ページ」の両方で利用可能に
- 今後、`getNodeTypeConfig()` を修正するだけで両方に反映されるため、保守性が大幅に向上
- コードの重複が削減され、DRY 原則を徹底

**一元化したノード**:
- ✅ `elevenlabs` - 音声ID、モデル（v3含む）、テキスト
- ✅ `gemini` - モデル、プロンプト
- ✅ `nanobana` - アスペクト比、プロンプト、キャラクターシート、参照画像
- ✅ `higgsfield` - プロンプト、ネガティブプロンプト、動画の長さ、CFG Scale、プロンプト自動強化
- ✅ `seedream4` - プロンプト、アスペクト比、品質、キャラクターシート、参照画像

### 2025-01-16: ワークフロー実行のAPI経由化とビルドエラー修正

**目的**: Client Component から Node.js モジュールを直接インポートすることによるビルドエラーを解決し、ワークフロー実行を適切にAPI経由で行う

**変更内容**:
- `/app/api/workflows/execute-draft/route.ts` を新規作成し、現在編集中のワークフローを実行するAPIエンドポイントを追加
- `/components/workflow/ExecutionPanel.tsx` を修正し、`executor.ts` の直接インポートを削除、API経由で実行するように変更
- `/next.config.ts` に Turbopack 設定と `serverExternalPackages` を追加し、Node.js モジュールのバンドルエラーを解決
- `/components/workflow/ElevenLabsNodeSettings.tsx` を `UnifiedNodeSettings` を使用するように簡素化（約370行 → 約20行）
- TypeScript エラーを修正（`lib/elevenlabs/constants.ts`, `app/api/workflows/execute/route.ts`, `lib/workflow/executor.ts`）

**技術的詳細**:
- Client Component から `@google-cloud/storage`, `pg` などの Node.js 専用モジュールを間接的にインポートしていたため、Turbopack ビルドで `child_process`, `fs`, `dns` などが解決できないエラーが発生
- `serverExternalPackages` 設定により、これらのパッケージをサーバーサイド専用として扱うように指定
- webpack の fallback 設定で、クライアントサイドでは Node.js モジュールを `false` に設定

**影響範囲**:
- ワークフロー実行がAPI経由になったため、サーバーサイドで適切に Node.js 機能を使用可能
- ビルドが成功し、本番環境へのデプロイが可能に
- ExecutionPanel の実行フローは維持されつつ、アーキテクチャが改善

### 2025-01-XX: ワークフローノード設定フォームの共通化

**目的**: コードの重複を削減し、保守性と拡張性を向上

**変更内容**:
- `/lib/workflow/formConfigGenerator.ts` に `getNodeTypeConfig()` を追加し、各ノードタイプの設定を一元管理
- `/components/form/DynamicFormField.tsx` に `slider` と `switch` フィールドタイプを追加
- `/components/workflow/UnifiedNodeSettings.tsx` を作成し、全ノードタイプで共通使用可能な設定UIを実装
- 各ノード設定コンポーネント（Gemini, ElevenLabs, Nanobana, Higgsfield, ImageInput）を簡素化（約300-700行 → 約20-25行）

**影響範囲**:
- 新しいノードタイプの追加が容易に（設定ファイルへの追加のみ）
- UIの一貫性向上
- バグ修正が一箇所で完結

**詳細**: [workflow-form-unification.md](/docs/workflow-form-unification.md)

---

## アーキテクチャの原則

### 設定の一元管理
- ノード設定は `/lib/workflow/formConfigGenerator.ts` の `getNodeTypeConfig()` で一元管理
- `extractFormFieldsFromNodes()` は `getNodeTypeConfig()` を呼び出して設定を再利用（重複を排除）
- 1箇所の修正で「ワークフローノード設定」と「`/form` ページ」の両方に自動反映
- UIコンポーネントは設定に基づいて動的に生成

### コンポーネントの再利用
- 共通のUIパターンは `DynamicFormField` で実装
- ノード固有のロジックは最小限に

### データの整合性
- 画像データは GCP Storage に保存し、`storagePath` で参照
- 一部の既存実装（Nanobana の `referenceImages`）は後方互換性のため例外的に base64 形式を保持

---

## 開発ガイドライン

### 新しいノードタイプの追加

1. `/lib/workflow/formConfigGenerator.ts` の `getNodeTypeConfig()` に設定を追加
2. `/components/workflow/XxxNodeSettings.tsx` を作成（UnifiedNodeSettings をラップ）
3. 必要に応じてデフォルト値を `UnifiedNodeSettings.tsx` に追加

**重要**: `getNodeTypeConfig()` で定義した設定は、以下の両方に**自動的に反映**されます：
- ワークフローノード設定（`UnifiedNodeSettings` で使用）
- `/form` ページ（`extractFormFieldsFromNodes()` で使用）

**そのため、設定の追加・変更は `getNodeTypeConfig()` のみで行ってください。**

詳細は [workflow-form-unification.md](/docs/workflow-form-unification.md#新しいノードタイプの追加方法) を参照。

### 新しいフィールドタイプの追加

1. `FormFieldConfig` インターフェースに型を追加
2. `DynamicFormField.tsx` にレンダリングロジックを実装

詳細は [workflow-form-unification.md](/docs/workflow-form-unification.md#dynamicformfieldの拡張) を参照。

---

## 注意事項

- **データベース操作**: マイグレーションや削除は慎重に。確認なしで実行しない。
- **後方互換性**: 既存のワークフローデータとの互換性を維持すること。
- **画像データ**: 新規実装では `storagePath` ベースを推奨。既存データの移行は段階的に。

---

## 参考資料

- [README.md](/README.md) - プロジェクト概要
- [QUICKSTART.md](/QUICKSTART.md) - クイックスタートガイド
- [DATABASE.md](/DATABASE.md) - データベーススキーマ
- [AUTHENTICATION.md](/AUTHENTICATION.md) - 認証システム
