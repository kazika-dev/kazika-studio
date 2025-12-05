# 素材画像マスター機能 (`m_material_images`)

## 概要

素材画像マスター機能は、ワークフローで使用する画像素材をカテゴリ分けして一元管理するための機能です。

画像ファイルはGCP Storageの `images/materials/` フォルダに保存され、テーブルにはファイルパスとメタデータが記録されます。ワークフローノード（Nanobana、Gemini、Seedream4など）から選択して使用できます。

## テーブル設計

### 1. 素材画像マスターテーブル (`m_material_images`)

```sql
CREATE TABLE IF NOT EXISTS kazikastudio.m_material_images (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,                           -- 素材名（表示用）
  description TEXT DEFAULT '',                  -- 素材の説明
  storage_path TEXT NOT NULL UNIQUE,            -- GCP Storageのファイルパス
  thumbnail_path TEXT,                          -- サムネイル画像のパス（オプション）
  category_id BIGINT REFERENCES kazikastudio.m_material_image_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',                     -- タグ配列（検索用）
  width INTEGER,                                -- 画像の幅（ピクセル）
  height INTEGER,                               -- 画像の高さ（ピクセル）
  file_size_bytes BIGINT,                       -- ファイルサイズ（バイト）
  mime_type TEXT DEFAULT 'image/png',           -- MIMEタイプ
  metadata JSONB DEFAULT '{}'::jsonb,           -- 追加メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 2. カテゴリマスターテーブル (`m_material_image_categories`)

```sql
CREATE TABLE IF NOT EXISTS kazikastudio.m_material_image_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,                    -- カテゴリ名
  description TEXT DEFAULT '',                  -- カテゴリの説明
  icon TEXT DEFAULT '',                         -- アイコン名（MUIアイコン）
  color TEXT DEFAULT '#1976d2',                 -- カテゴリカラー
  sequence_order INTEGER DEFAULT 0,             -- 表示順序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## フィールド詳細

### `m_material_images` テーブル

| カラム名 | 型 | 説明 | 例 |
|---------|-----|------|---|
| `id` | BIGSERIAL | 素材ID（自動採番） | `1` |
| `name` | TEXT | 素材名（表示用） | `"桜の木の背景"` |
| `description` | TEXT | 素材の説明 | `"春の桜の木を描いた背景画像"` |
| `storage_path` | TEXT | GCP Storageのファイルパス（UNIQUE） | `"images/materials/backgrounds/sakura-tree.png"` |
| `thumbnail_path` | TEXT | サムネイル画像のパス（オプション） | `"images/materials/thumbnails/sakura-tree-thumb.jpg"` |
| `category_id` | BIGINT | カテゴリID（外部キー） | `1` |
| `tags` | TEXT[] | タグ配列（検索用） | `["背景", "桜", "春", "屋外"]` |
| `width` | INTEGER | 画像の幅（ピクセル） | `1920` |
| `height` | INTEGER | 画像の高さ（ピクセル） | `1080` |
| `file_size_bytes` | BIGINT | ファイルサイズ（バイト） | `2456789` |
| `mime_type` | TEXT | MIMEタイプ | `"image/png"`, `"image/jpeg"` |
| `metadata` | JSONB | 追加メタデータ | `{"author": "...", "license": "..."}` |
| `created_at` | TIMESTAMPTZ | 作成日時 | `2025-11-20 12:00:00+00` |
| `updated_at` | TIMESTAMPTZ | 更新日時（自動更新） | `2025-11-20 12:00:00+00` |

### `m_material_image_categories` テーブル

| カラム名 | 型 | 説明 | 例 |
|---------|-----|------|---|
| `id` | BIGSERIAL | カテゴリID（自動採番） | `1` |
| `name` | TEXT | カテゴリ名（UNIQUE） | `"背景"`, `"キャラクター素材"`, `"小物"` |
| `description` | TEXT | カテゴリの説明 | `"背景画像（風景、室内など）"` |
| `icon` | TEXT | アイコン名（MUIアイコン） | `"Landscape"`, `"Person"`, `"Category"` |
| `color` | TEXT | カテゴリカラー | `"#1976d2"`, `"#9c27b0"` |
| `sequence_order` | INTEGER | 表示順序 | `0`, `1`, `2` |
| `created_at` | TIMESTAMPTZ | 作成日時 | `2025-11-20 12:00:00+00` |
| `updated_at` | TIMESTAMPTZ | 更新日時（自動更新） | `2025-11-20 12:00:00+00` |

## インデックス

### `m_material_images` テーブル

```sql
-- 名前検索
CREATE INDEX idx_m_material_images_name ON kazikastudio.m_material_images(name);

-- storage_path検索（UNIQUE）
CREATE INDEX idx_m_material_images_storage_path ON kazikastudio.m_material_images(storage_path);

-- カテゴリ検索
CREATE INDEX idx_m_material_images_category_id ON kazikastudio.m_material_images(category_id);

-- タグ検索（GINインデックス）
CREATE INDEX idx_m_material_images_tags ON kazikastudio.m_material_images USING GIN(tags);

-- 作成日時降順
CREATE INDEX idx_m_material_images_created_at ON kazikastudio.m_material_images(created_at DESC);
```

### `m_material_image_categories` テーブル

```sql
-- カテゴリ名検索（UNIQUE）
CREATE INDEX idx_m_material_image_categories_name ON kazikastudio.m_material_image_categories(name);

-- 表示順序
CREATE INDEX idx_m_material_image_categories_sequence ON kazikastudio.m_material_image_categories(sequence_order);
```

## Row Level Security (RLS)

### ポリシー

- **全ユーザーが読み取り可能** - マスターデータのため、すべてのユーザーが素材画像一覧を参照できます
- **認証済みユーザーが編集可能** - 追加・更新・削除には認証が必要です

```sql
-- m_material_images: 全ユーザーが参照可能
CREATE POLICY "Anyone can view material images"
  ON kazikastudio.m_material_images
  FOR SELECT
  USING (true);

-- m_material_images: 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert material images"
  ON kazikastudio.m_material_images
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update material images"
  ON kazikastudio.m_material_images
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete material images"
  ON kazikastudio.m_material_images
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- m_material_image_categories: 全ユーザーが参照可能
CREATE POLICY "Anyone can view material image categories"
  ON kazikastudio.m_material_image_categories
  FOR SELECT
  USING (true);

-- m_material_image_categories: 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert material image categories"
  ON kazikastudio.m_material_image_categories
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update material image categories"
  ON kazikastudio.m_material_image_categories
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete material image categories"
  ON kazikastudio.m_material_image_categories
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
```

## GCP Storageとの連携

### フォルダ構造

```
GCP Storage Bucket (kazikastudio-storage)
└── images/
    └── materials/
        ├── backgrounds/           # 背景画像
        │   ├── sakura-tree.png
        │   └── school-rooftop.jpg
        ├── characters/            # キャラクター素材
        │   ├── girl-standing.png
        │   └── boy-walking.png
        ├── props/                 # 小物
        │   ├── book.png
        │   └── smartphone.png
        ├── effects/               # エフェクト
        │   ├── sparkle.png
        │   └── shadow.png
        └── thumbnails/            # サムネイル（自動生成）
            ├── sakura-tree-thumb.jpg
            └── school-rooftop-thumb.jpg
```

### ファイル名規則

- **フォルダ**: `images/materials/{category}/`
- **ファイル名**: 英数字、ハイフン、アンダースコアのみ推奨
- **拡張子**: `.png`, `.jpg`, `.jpeg`, `.webp` など

例:
```
images/materials/backgrounds/sakura-tree.png
images/materials/characters/girl-standing.png
images/materials/props/smartphone.png
```

### ファイルのアップロード・取得

GCP Storageからのファイル操作には `/lib/gcp-storage.ts` の関数を使用します:

```typescript
import { uploadImageToStorage, getSignedUrl, getFileFromStorage } from '@/lib/gcp-storage';

// 画像のアップロード
const storagePath = await uploadImageToStorage(
  base64ImageData,
  'image/png',
  'sakura-tree.png',
  'images/materials/backgrounds'
);
// → 戻り値: "images/materials/backgrounds/sakura-tree.png"

// 署名付きURLの取得（表示用）
const signedUrl = await getSignedUrl('images/materials/backgrounds/sakura-tree.png');

// ファイルデータの取得
const { data, contentType } = await getFileFromStorage('images/materials/backgrounds/sakura-tree.png');
```

## データベース関数 (`/lib/db.ts`)

### 素材画像の取得

```typescript
import {
  getAllMaterialImages,
  getMaterialImageById,
  getMaterialImagesByCategory,
  getMaterialImagesByTag,
} from '@/lib/db';

// 全ての素材画像を取得（カテゴリ→名前でソート）
const allImages = await getAllMaterialImages();

// IDで取得
const image = await getMaterialImageById(1);

// カテゴリで取得
const backgroundImages = await getMaterialImagesByCategory(1);

// タグで検索
const sakuraImages = await getMaterialImagesByTag('桜');
```

### 素材画像の作成・更新・削除

```typescript
import {
  createMaterialImage,
  updateMaterialImage,
  deleteMaterialImage,
} from '@/lib/db';

// 素材画像を作成
const newImage = await createMaterialImage({
  name: '桜の木の背景',
  description: '春の桜の木を描いた背景画像',
  storage_path: 'images/materials/backgrounds/sakura-tree.png',
  thumbnail_path: 'images/materials/thumbnails/sakura-tree-thumb.jpg',
  category_id: 1,
  tags: ['背景', '桜', '春', '屋外'],
  width: 1920,
  height: 1080,
  file_size_bytes: 2456789,
  mime_type: 'image/png',
});

// 素材画像を更新
const updated = await updateMaterialImage(1, {
  description: '満開の桜の木を描いた背景画像',
  tags: ['背景', '桜', '春', '屋外', '満開'],
});

// 素材画像を削除
const deleted = await deleteMaterialImage(1);
```

### カテゴリの操作

```typescript
import {
  getAllMaterialImageCategories,
  getMaterialImageCategoryById,
  createMaterialImageCategory,
  updateMaterialImageCategory,
  deleteMaterialImageCategory,
} from '@/lib/db';

// 全てのカテゴリを取得（sequence_order順）
const categories = await getAllMaterialImageCategories();

// カテゴリを作成
const newCategory = await createMaterialImageCategory({
  name: '背景',
  description: '背景画像（風景、室内など）',
  icon: 'Landscape',
  color: '#1976d2',
  sequence_order: 0,
});
```

## API エンドポイント

### 素材画像API

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| `GET` | `/api/material-images` | 素材画像一覧を取得（カテゴリ・タグでフィルタリング可能） |
| `GET` | `/api/material-images/[id]` | 素材画像の詳細を取得 |
| `POST` | `/api/material-images` | 素材画像を作成（画像アップロード含む） |
| `PUT` | `/api/material-images/[id]` | 素材画像を更新 |
| `DELETE` | `/api/material-images/[id]` | 素材画像を削除（GCP Storageからも削除） |
| `GET` | `/api/material-images/[id]/download` | 素材画像のダウンロード（署名付きURL） |

### カテゴリAPI

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| `GET` | `/api/material-image-categories` | カテゴリ一覧を取得 |
| `GET` | `/api/material-image-categories/[id]` | カテゴリの詳細を取得 |
| `POST` | `/api/material-image-categories` | カテゴリを作成 |
| `PUT` | `/api/material-image-categories/[id]` | カテゴリを更新 |
| `DELETE` | `/api/material-image-categories/[id]` | カテゴリを削除 |

### APIリクエスト例

```typescript
// 素材画像の作成
const formData = new FormData();
formData.append('name', '桜の木の背景');
formData.append('description', '春の桜の木を描いた背景画像');
formData.append('category_id', '1');
formData.append('tags', JSON.stringify(['背景', '桜', '春', '屋外']));
formData.append('file', imageFile); // File object

const response = await fetch('/api/material-images', {
  method: 'POST',
  body: formData,
});

// 素材画像の取得（フィルタリング）
const response = await fetch('/api/material-images?category_id=1&tag=桜');
const data = await response.json();

// 素材画像の削除
const response = await fetch('/api/material-images/1', {
  method: 'DELETE',
});
```

## UI コンポーネント

### 1. `/app/master/m_material_images/page.tsx`

素材画像の管理画面。カテゴリごとにグループ表示し、画像のプレビュー・追加・編集・削除を行う。

**機能**:
- カテゴリフィルター（タブ表示）
- タグ検索
- グリッド表示（サムネイル + 名前）
- 画像クリックで詳細ダイアログを表示
- 画像アップロード（ドラッグ&ドロップ対応）
- 一括削除機能

### 2. `/components/master/MaterialImagesManager.tsx`

素材画像管理のメインコンポーネント（`SoundEffectsManager.tsx` と同じパターン）

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Dialog, TextField, Grid, Autocomplete, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { toast } from 'sonner';

interface MaterialImage {
  id: number;
  name: string;
  description: string;
  storage_path: string;
  thumbnail_path: string | null;
  category_id: number | null;
  tags: string[];
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export default function MaterialImagesManager() {
  const [records, setRecords] = useState<MaterialImage[]>([]);
  const [categories, setCategories] = useState<MaterialImageCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // CRUD処理...
  // 画像アップロード処理...
  // プレビュー表示処理...
}
```

### 3. `/components/master/MaterialImageCategoriesManager.tsx`

カテゴリ管理コンポーネント（カテゴリの追加・編集・削除・順序変更）

### 4. `/components/form/MaterialImageSelector.tsx`

ワークフローノード設定で素材画像を選択するためのコンポーネント（`DynamicFormField.tsx` から呼び出される）

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, Grid, Checkbox, Card, CardMedia, Typography } from '@mui/material';

export default function MaterialImageSelector({
  value,
  onChange,
  maxSelections = 4
}: MaterialImageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<MaterialImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(value || []);

  // 素材画像の選択UI（OutputSelectorと同じパターン）
  // カテゴリフィルター、タグ検索機能付き
}
```

## ワークフローノードとの連携

### 1. `getNodeTypeConfig()` への追加

`/lib/workflow/formConfigGenerator.ts` の各ノードに `selectedMaterialImageIds` フィールドを追加:

```typescript
case 'nanobana':
  return {
    fields: [
      // ... 既存のフィールド ...
      {
        name: 'selectedMaterialImageIds',
        label: '素材画像',
        type: 'materialImageSelector',
        defaultValue: [],
        validation: { maxSelections: 4 },
      },
    ],
  };
```

### 2. `DynamicFormField.tsx` への追加

`materialImageSelector` フィールドタイプを追加:

```tsx
case 'materialImageSelector':
  return (
    <MaterialImageSelector
      value={value}
      onChange={onChange}
      maxSelections={field.validation?.maxSelections || 4}
    />
  );
```

### 3. `executor.ts` での画像読み込み

Nanobana/Gemini/Seedream4ノードで素材画像を読み込む処理を追加:

```typescript
// 素材画像を読み込み（selectedMaterialImageIds）
if (config.selectedMaterialImageIds && Array.isArray(config.selectedMaterialImageIds)) {
  for (const imageId of config.selectedMaterialImageIds.slice(0, 4)) {
    const materialImage = await getMaterialImageById(imageId);
    if (materialImage && materialImage.storage_path) {
      const { data, contentType } = await getFileFromStorage(materialImage.storage_path);
      const base64 = data.toString('base64');
      images.push({ base64, contentType });
    }
  }
}
```

## 実装フェーズ

### Phase 1: データベース・マイグレーション

- [ ] マイグレーションファイルの作成
  - `/supabase/migrations/YYYYMMDD_create_material_images_master_tables.sql`
  - `m_material_image_categories` テーブルの作成
  - `m_material_images` テーブルの作成
  - インデックス・RLSポリシーの設定
  - 初期カテゴリデータの投入

### Phase 2: データベース関数・API

- [ ] `/lib/db.ts` に関数を追加
  - `getAllMaterialImages()`, `getMaterialImageById()`, `getMaterialImagesByCategory()`, `getMaterialImagesByTag()`
  - `createMaterialImage()`, `updateMaterialImage()`, `deleteMaterialImage()`
  - `getAllMaterialImageCategories()`, `getMaterialImageCategoryById()`
  - `createMaterialImageCategory()`, `updateMaterialImageCategory()`, `deleteMaterialImageCategory()`

- [ ] API エンドポイントの作成
  - `/app/api/material-images/route.ts` (GET, POST)
  - `/app/api/material-images/[id]/route.ts` (GET, PUT, DELETE)
  - `/app/api/material-images/[id]/download/route.ts` (GET)
  - `/app/api/material-image-categories/route.ts` (GET, POST)
  - `/app/api/material-image-categories/[id]/route.ts` (GET, PUT, DELETE)

### Phase 3: UI コンポーネント

- [ ] `/components/master/MaterialImagesManager.tsx`
  - 画像一覧表示（グリッド）
  - カテゴリフィルター
  - タグ検索
  - 画像アップロード（ドラッグ&ドロップ対応）
  - 画像プレビューダイアログ
  - 編集・削除機能

- [ ] `/components/master/MaterialImageCategoriesManager.tsx`
  - カテゴリ一覧表示
  - カテゴリ作成・編集・削除
  - 順序変更（ドラッグ&ドロップ）

- [ ] `/app/master/m_material_images/page.tsx`
  - マスター管理画面のエントリーポイント

### Phase 4: ワークフロー連携

- [ ] `/components/form/MaterialImageSelector.tsx`
  - 素材画像選択UI（OutputSelectorと同じパターン）
  - カテゴリフィルター、タグ検索
  - 複数選択対応（最大4枚）

- [ ] `/lib/workflow/formConfigGenerator.ts`
  - 各ノードに `selectedMaterialImageIds` フィールドを追加
  - Nanobana, Gemini, Seedream4 ノードに対応

- [ ] `/components/form/DynamicFormField.tsx`
  - `materialImageSelector` フィールドタイプを追加

- [ ] `/lib/workflow/executor.ts`
  - 素材画像読み込み処理を追加
  - Nanobana, Gemini, Seedream4 ノードで対応

### Phase 5: `/master` ページへの追加

- [ ] `/app/master/page.tsx`
  - 素材画像マスターのカードを追加
  - アイコン: `Image`, `Collections`, `PhotoLibrary` など
  - カラー: `#ff9800` (オレンジ系) または `#4caf50` (緑系)

## 初期カテゴリデータ

```sql
INSERT INTO kazikastudio.m_material_image_categories (name, description, icon, color, sequence_order) VALUES
  ('背景', '背景画像（風景、室内など）', 'Landscape', '#1976d2', 0),
  ('キャラクター素材', 'キャラクター関連の素材', 'Person', '#9c27b0', 1),
  ('小物', '小物や道具の素材', 'Category', '#ff9800', 2),
  ('エフェクト', 'エフェクト素材（光、影など）', 'AutoAwesome', '#f44336', 3),
  ('テクスチャ', 'テクスチャ素材', 'Texture', '#4caf50', 4),
  ('その他', 'その他の素材', 'MoreHoriz', '#757575', 5)
ON CONFLICT DO NOTHING;
```

## 技術的詳細

### 画像アップロード処理

1. ユーザーが画像ファイルを選択（File API）
2. ブラウザで画像をBase64に変換
3. API (`POST /api/material-images`) に送信
4. サーバー側で `uploadImageToStorage()` を呼び出し、GCP Storageにアップロード
5. `storage_path` を受け取り、データベースに保存
6. サムネイル生成（オプション）: Sharp ライブラリで 200x200 にリサイズし、`thumbnails/` フォルダに保存

### サムネイル生成

```typescript
import sharp from 'sharp';

// サムネイル生成（200x200、アスペクト比維持）
const thumbnailBuffer = await sharp(imageBuffer)
  .resize(200, 200, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toBuffer();

const thumbnailPath = await uploadImageToStorage(
  thumbnailBuffer.toString('base64'),
  'image/jpeg',
  `${originalFileName}-thumb.jpg`,
  'images/materials/thumbnails'
);
```

### ワークフローノードでの使用例

```typescript
// Nanobanaノードの設定
{
  prompt: "a girl standing in front of a cherry tree",
  aspectRatio: "16:9",
  selectedCharacterSheetIds: [1, 2],      // キャラクターシート
  selectedMaterialImageIds: [10, 15],     // 素材画像（NEW!）
  selectedOutputIds: [100]                 // Output画像
}

// executor.ts での処理
const images = [];

// 1. キャラクターシートを読み込み
// 2. 素材画像を読み込み（NEW!）
for (const imageId of config.selectedMaterialImageIds || []) {
  const materialImage = await getMaterialImageById(imageId);
  if (materialImage && materialImage.storage_path) {
    const { data, contentType } = await getFileFromStorage(materialImage.storage_path);
    images.push({ base64: data.toString('base64'), contentType });
  }
}
// 3. Output画像を読み込み
// 4. Nanobana APIに送信
```

## 影響範囲

### 新規追加

- データベーステーブル: `m_material_images`, `m_material_image_categories`
- API エンドポイント: `/api/material-images`, `/api/material-image-categories`
- UI コンポーネント: `MaterialImagesManager`, `MaterialImageCategoriesManager`, `MaterialImageSelector`
- `/master` ページに素材画像マスターのカードを追加

### 既存機能への影響

- ワークフローノード設定に `selectedMaterialImageIds` フィールドを追加
- `DynamicFormField.tsx` に `materialImageSelector` フィールドタイプを追加
- `executor.ts` の各ノードで素材画像読み込み処理を追加

### 後方互換性

- 既存のワークフローデータには影響なし（`selectedMaterialImageIds` は省略可能）
- 既存の参照画像機能（`referenceImages`, `referenceImagePaths`）と共存可能

---

## まとめ

この設計により、以下のメリットが得られます:

1. **一元管理**: 素材画像をカテゴリ分けして管理し、複数のワークフローで再利用可能
2. **検索性**: タグとカテゴリで素材を素早く検索
3. **一貫性**: 既存の効果音マスター機能と同じパターンで実装し、保守性を向上
4. **拡張性**: カテゴリやタグを自由に追加・編集可能
5. **ワークフロー連携**: Output画像と同じUIパターンで、ワークフローノードから簡単に選択可能

実装は Phase 1 から順次進め、各フェーズで動作確認を行います。
