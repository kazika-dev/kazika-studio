# Claude Code 開発メモ

DBへのマイグレーションやdeleteは確認なしで行わないでください。
追加修正したものは `/docs` ディレクトリにまとめてください。


このファイルは、Claude Codeによる開発の履歴と重要なアーキテクチャ情報をまとめたものです。

## ドキュメント

プロジェクトの詳細なドキュメントは `/docs` ディレクトリにあります:

- **[ワークフローノード設定フォームの共通化](/docs/workflow-form-unification.md)** - ノード設定UIの統一アーキテクチャ

## 最近の主要な変更

### 2025-11-16: Nanobanaノード設定にOutput画像選択フォームを追加

**目的**: Workflow Outputsテーブルから生成済み画像を選択できるようにし、既存の画像を再利用可能にする

**変更内容**:
- `/components/form/DynamicFormField.tsx` に `outputSelector` フィールドタイプを追加（132行追加）
- `/api/outputs` から画像タイプのoutputを取得し、2カラムのグリッドレイアウトでサムネイル表示
- Nanobanaノード設定に `selectedOutputId` フィールドを追加（`getNodeTypeConfig()` で一元管理）
- `/components/workflow/UnifiedNodeSettings.tsx` で `outputSelector` のデフォルト値を設定
- `/app/api/outputs/route.ts` をテーブルスキーマ (`output_url`, `output_data`) に合わせて修正

**技術的詳細**:
- CLAUDE.mdの原則に従い、`getNodeTypeConfig()` で1箇所定義することで、ワークフローノード設定と `/form` ページの両方で自動的に利用可能
- ラジオボタンで画像を1つ選択し、選択されたoutputのIDを `selectedOutputId` として保存
- デバッグログを追加して、フィールドのレンダリングとAPI呼び出しを追跡可能に
- マイグレーションSQLで定義された実際のカラム名 (`output_url`, `output_data`) に合わせてAPIを修正

**影響範囲**:
- Nanobanaノード設定画面に新しいフィールドが追加され、過去の生成画像を選択可能に
- `/form` ページでも自動的に表示される（一元管理の恩恵）
- `workflow_outputs` テーブルから画像データを正しく取得できるようになった

**コミット**:
- `33bbedf` - "Nanobanaノード設定にoutput画像選択フォームを追加"
- `aaf7aa3` - "OutputSelectorでcontent_urlフィールドに対応"
- `d79b997` - "workflow_outputsテーブルスキーマに合わせてAPI修正"

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
