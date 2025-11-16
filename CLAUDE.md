# Claude Code 開発メモ

DBへのマイグレーションやdeleteは確認なしで行わないでください。
追加修正したものは `/docs` ディレクトリにまとめてください。


このファイルは、Claude Codeによる開発の履歴と重要なアーキテクチャ情報をまとめたものです。

## ドキュメント

プロジェクトの詳細なドキュメントは `/docs` ディレクトリにあります:

- **[ワークフローノード設定フォームの共通化](/docs/workflow-form-unification.md)** - ノード設定UIの統一アーキテクチャ
- **[ワークフロー設定値のデフォルト値反映機能](/docs/workflow-config-default-values.md)** - ワークフローエディタの設定値を `/form` ページのデフォルト値として反映

## 最近の主要な変更

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
