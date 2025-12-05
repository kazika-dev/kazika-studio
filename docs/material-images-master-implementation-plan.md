# 素材画像マスター機能 - 実装計画サマリー

## 概要

ワークフローで使用する画像素材をカテゴリ分けして一元管理する機能を追加します。

## 目的

- 素材画像を一元管理し、複数のワークフローで再利用可能にする
- カテゴリとタグで素材を分類・検索しやすくする
- ワークフローノード（Nanobana, Gemini, Seedream4）から簡単に選択できるようにする

## 実装フェーズ

### Phase 1: データベース・マイグレーション ⏱️ 1-2時間

**作業内容**:
- マイグレーションファイルの作成（タイムスタンプを付けてリネーム）
- 2つのテーブルを作成:
  - `m_material_image_categories`: カテゴリマスター
  - `m_material_images`: 素材画像マスター
- インデックス、RLSポリシー、初期カテゴリデータを投入
- マイグレーションの実行と動作確認

**ファイル**:
- `supabase/migrations/YYYYMMDD_create_material_images_master_tables.sql`（DRAFTファイルをリネーム）

**確認項目**:
- [ ] マイグレーションが正常に実行される
- [ ] テーブルが正しく作成される
- [ ] 初期カテゴリデータが投入される
- [ ] RLSポリシーが機能する（認証済みユーザーのみ編集可能）

---

### Phase 2: データベース関数・API ⏱️ 3-4時間

**作業内容**:
- `/lib/db.ts` に関数を追加（約200-300行）
- API エンドポイントを作成（約600-800行）

**ファイル**:

1. `/lib/db.ts`:
   - `getAllMaterialImages()`, `getMaterialImageById()`
   - `getMaterialImagesByCategory()`, `getMaterialImagesByTag()`
   - `createMaterialImage()`, `updateMaterialImage()`, `deleteMaterialImage()`
   - `getAllMaterialImageCategories()`, `getMaterialImageCategoryById()`
   - `createMaterialImageCategory()`, `updateMaterialImageCategory()`, `deleteMaterialImageCategory()`

2. `/app/api/material-images/route.ts` (GET, POST)
3. `/app/api/material-images/[id]/route.ts` (GET, PUT, DELETE)
4. `/app/api/material-images/[id]/download/route.ts` (GET)
5. `/app/api/material-image-categories/route.ts` (GET, POST)
6. `/app/api/material-image-categories/[id]/route.ts` (GET, PUT, DELETE)

**参考実装**:
- `/app/api/sound-effects/` - 効果音マスターのAPIと同じパターンで実装

**確認項目**:
- [ ] すべてのAPIエンドポイントが正常に動作する
- [ ] 画像アップロード（GCP Storage連携）が機能する
- [ ] カテゴリのCRUDが機能する
- [ ] エラーハンドリングが適切に行われる

---

### Phase 3: UI コンポーネント ⏱️ 4-6時間

**作業内容**:
- 素材画像管理画面を作成（約500-700行）
- カテゴリ管理画面を作成（約300-400行）

**ファイル**:

1. `/components/master/MaterialImagesManager.tsx`
   - 画像一覧表示（グリッド）
   - カテゴリフィルター（タブ）
   - タグ検索
   - 画像アップロード（ドラッグ&ドロップ対応）
   - 画像プレビューダイアログ
   - 編集・削除機能

2. `/components/master/MaterialImageCategoriesManager.tsx`
   - カテゴリ一覧表示
   - カテゴリ作成・編集・削除
   - 順序変更（ドラッグ&ドロップ）

3. `/app/master/m_material_images/page.tsx`
   - マスター管理画面のエントリーポイント

4. `/app/master/page.tsx`
   - 素材画像マスターのカードを追加

**参考実装**:
- `/components/master/SoundEffectsManager.tsx` - 効果音マスターのUIと同じパターンで実装

**確認項目**:
- [ ] 画像一覧が正しく表示される
- [ ] カテゴリフィルターが機能する
- [ ] タグ検索が機能する
- [ ] 画像アップロード（ドラッグ&ドロップ）が機能する
- [ ] 画像プレビューダイアログが表示される
- [ ] 編集・削除が機能する
- [ ] カテゴリ管理が機能する

---

### Phase 4: ワークフロー連携 ⏱️ 3-4時間

**作業内容**:
- ワークフローノードから素材画像を選択できるようにする

**ファイル**:

1. `/components/form/MaterialImageSelector.tsx`
   - 素材画像選択UI（OutputSelectorと同じパターン）
   - カテゴリフィルター、タグ検索
   - 複数選択対応（最大4枚）
   - ポップアップダイアログ + ページング表示

2. `/lib/workflow/formConfigGenerator.ts`
   - `getNodeTypeConfig()` の各ノードに `selectedMaterialImageIds` フィールドを追加
   - Nanobana, Gemini, Seedream4 ノードに対応

3. `/components/form/DynamicFormField.tsx`
   - `materialImageSelector` フィールドタイプを追加

4. `/lib/workflow/executor.ts`
   - Nanobana, Gemini, Seedream4 ノードで素材画像を読み込む処理を追加
   - `selectedMaterialImageIds` から `m_material_images` テーブルを検索
   - GCP Storageから画像を取得してbase64に変換
   - API送信時に含める

**参考実装**:
- `/components/form/DynamicFormField.tsx` の `outputSelector` ケース
- `/lib/workflow/executor.ts` の Output画像読み込み処理

**確認項目**:
- [ ] ワークフローノード設定で素材画像選択UIが表示される
- [ ] `/form` ページでも素材画像選択UIが表示される（一元管理の恩恵）
- [ ] 素材画像を選択して保存できる
- [ ] ワークフロー実行時に素材画像が正しく読み込まれる
- [ ] Nanobana, Gemini, Seedream4 APIに画像が正しく送信される

---

## 技術スタック

### データベース
- PostgreSQL (Supabase)
- Row Level Security (RLS)
- GINインデックス（タグ検索）

### ストレージ
- GCP Storage (`images/materials/` フォルダ)
- サムネイル生成（Sharp ライブラリ）

### API
- Next.js App Router (API Routes)
- FormData（画像アップロード）
- `/lib/gcp-storage.ts` 関数（GCP Storage連携）

### UI
- React + TypeScript
- Material-UI (MUI)
- Sonner (トースト通知)
- ドラッグ&ドロップ（react-dropzone または File API）

---

## 見積もり

| フェーズ | 作業時間 | 累計 |
|---------|---------|------|
| Phase 1: データベース・マイグレーション | 1-2時間 | 1-2時間 |
| Phase 2: データベース関数・API | 3-4時間 | 4-6時間 |
| Phase 3: UI コンポーネント | 4-6時間 | 8-12時間 |
| Phase 4: ワークフロー連携 | 3-4時間 | 11-16時間 |
| **合計** | **11-16時間** | - |

## 依存関係

### 既存の実装パターン
- 効果音マスター (`m_sound_effects`) と同じパターンで実装
- Output画像選択 (`outputSelector`) と同じUIパターンで実装
- 一元管理の原則（`getNodeTypeConfig()`）に従う

### 必要なライブラリ
- `@google-cloud/storage` (既存)
- `sharp` (サムネイル生成用、必要に応じて追加)
- `react-dropzone` (ドラッグ&ドロップ用、オプション)

---

## リスクと対策

### リスク1: 画像サイズによるパフォーマンス問題

**対策**:
- サムネイル生成（200x200）を実装し、一覧表示ではサムネイルを使用
- 画像一覧APIでページネーションを実装（最初は20件まで）
- GCP Storageの署名付きURLを使用してキャッシュを活用

### リスク2: 既存のワークフローとの互換性

**対策**:
- `selectedMaterialImageIds` は省略可能（デフォルト: `[]`）
- 既存の `referenceImages`, `referenceImagePaths` と共存可能
- 後方互換性を完全に維持

### リスク3: GCP Storageの容量とコスト

**対策**:
- ファイルサイズ制限（1画像あたり5MB以下）をフロントエンドで実装
- 削除時にGCP Storageからも削除する処理を実装
- 定期的に使用されていない素材画像をクリーンアップする機能を追加（将来）

---

## テスト計画

### 単体テスト
- [ ] データベース関数が正しく動作する
- [ ] APIエンドポイントが正しいレスポンスを返す
- [ ] 画像アップロード処理が正常に完了する

### 統合テスト
- [ ] 素材画像を作成 → 一覧に表示される
- [ ] カテゴリを作成 → 素材画像に紐付けられる
- [ ] 素材画像を削除 → GCP Storageからも削除される
- [ ] ワークフローノードで素材画像を選択 → 実行時に正しく読み込まれる

### E2Eテスト
- [ ] `/master/m_material_images` ページで素材画像をアップロード
- [ ] ワークフローエディタで Nanobana ノードを開き、素材画像を選択
- [ ] ワークフローを保存して実行
- [ ] Nanobana API に画像が正しく送信される
- [ ] 生成された画像に素材が反映されている

---

## 実装後のメリット

### 1. 生産性向上
- 素材画像を一元管理し、複数のワークフローで再利用可能
- 毎回画像をアップロードする手間が省ける

### 2. 検索性向上
- カテゴリとタグで素材を素早く検索
- 「背景」「キャラクター」「小物」などで分類

### 3. 一貫性向上
- 効果音マスターと同じパターンで実装
- ワークフローノード設定の一元管理（`getNodeTypeConfig()`）により保守性が向上

### 4. 拡張性
- 将来的にライセンス情報やアップロード者情報をメタデータに追加可能
- 共有機能（他のユーザーの素材を閲覧・使用）を追加可能

---

## 参考ドキュメント

- [素材画像マスター機能 - 詳細設計](/docs/material-images-master.md)
- [効果音マスターテーブル](/docs/sound-effects-master.md)
- [ワークフローノード設定フォームの共通化](/docs/workflow-form-unification.md)
- [GCP Storage セットアップ](/docs/GCP_STORAGE_SETUP.md)

---

## 次のステップ

1. **Phase 1 から順次実装**を開始します
2. 各フェーズの完了後、動作確認とドキュメント更新を行います
3. 実装中に気づいた点や変更点は CLAUDE.md に記録します
4. 全フェーズ完了後、本番環境へのデプロイ計画を立てます
