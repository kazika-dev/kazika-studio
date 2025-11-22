# 画像素材マスタ機能

## 概要

ワークフローで使用する画像素材（背景、テクスチャ、パーツなど）を管理するマスタ機能です。既存の効果音マスタと同様に、GCP Storageに画像を保存し、データベースでメタデータを管理します。

## 主要機能

### 1. 画像アップロード
- **対応フォーマット**: PNG, JPG, JPEG, WEBP
- **ファイルサイズ制限**: 最大10MB
- **保存先**: GCP Storageの `materials/` フォルダ

### 2. メタデータ管理
- **素材名** (name): 表示用の名称
- **説明** (description): 素材の詳細説明
- **カテゴリ** (category): 背景、キャラクター、テクスチャ、パーツ、その他
- **タグ** (tags): 検索用のタグ配列
- **画像サイズ**: 幅 × 高さ（自動取得）
- **ファイルサイズ**: バイト単位（自動取得）

### 3. CRUD操作
- **一覧表示**: サムネイル付きで全素材を表示
- **新規作成**: 画像アップロード + メタデータ入力
- **編集**: メタデータのみ編集可能（画像の差し替えは削除→再作成）
- **削除**: データベース + GCP Storageから削除

## データベーススキーマ

### テーブル: `kazikastudio.m_image_materials`

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | BIGSERIAL | 画像素材ID（主キー） |
| `name` | TEXT | 素材名（表示用） |
| `description` | TEXT | 素材の説明 |
| `file_name` | TEXT | GCP Storageのファイル名（例: `materials/bg-school-001.png`） |
| `width` | INTEGER | 画像の幅（ピクセル） |
| `height` | INTEGER | 画像の高さ（ピクセル） |
| `file_size_bytes` | BIGINT | ファイルサイズ（バイト） |
| `category` | TEXT | カテゴリ（背景、キャラクター、テクスチャ、パーツ、その他） |
| `tags` | TEXT[] | タグ配列（検索用） |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時 |

### インデックス
- `idx_m_image_materials_name` - 名前で検索
- `idx_m_image_materials_file_name` - ファイル名で検索
- `idx_m_image_materials_category` - カテゴリでフィルター
- `idx_m_image_materials_tags` - タグで検索（GINインデックス）
- `idx_m_image_materials_created_at` - 作成日時で並び替え

### RLSポリシー
- **SELECT**: 全ユーザーが参照可能（`true`）
- **INSERT/UPDATE/DELETE**: 認証済みユーザーのみ（`auth.uid() IS NOT NULL`）

## GCP Storage フォルダ構造

```
GCP Storage Bucket
└── materials/            ← 画像素材マスタ
    ├── bg-school-corridor-day-1732233600-abc123.png
    ├── emotion-happy-1732233700-def456.png
    ├── texture-wood-floor-1732233800-ghi789.jpg
    └── parts-accessory-001-1732233900-jkl012.png
```

**ファイル名の構造**:
```
{baseName}-{timestamp}-{randomStr}.{extension}
```
- `baseName`: 元のファイル名から拡張子を除いた部分（特殊文字は`-`に変換）
- `timestamp`: アップロード時のUNIXタイムスタンプ
- `randomStr`: 6文字のランダム文字列
- `extension`: 元のファイルの拡張子

## API仕様

### GET /api/image-materials
**説明**: 画像素材の一覧取得（署名付きURL付き）

**レスポンス**:
```json
{
  "success": true,
  "materials": [
    {
      "id": 1,
      "name": "学校背景01",
      "description": "昼間の学校の廊下",
      "file_name": "materials/bg-school-corridor-day.png",
      "width": 1920,
      "height": 1080,
      "file_size_bytes": 2048576,
      "category": "背景",
      "tags": ["学校", "廊下", "昼間"],
      "created_at": "2025-11-22T12:00:00Z",
      "updated_at": "2025-11-22T12:00:00Z",
      "signed_url": "https://storage.googleapis.com/..."
    }
  ]
}
```

### POST /api/image-materials
**説明**: 画像素材の新規作成（ファイルアップロード含む）

**リクエスト** (FormData):
```
name: "学校背景01"
description: "昼間の学校の廊下"
category: "背景"
tags: ["学校", "廊下", "昼間"]
image: File (PNG, JPG, JPEG, WEBP, 最大10MB)
```

**レスポンス**:
```json
{
  "success": true,
  "material": {
    "id": 1,
    "name": "学校背景01",
    "file_name": "materials/bg-school-001-1732233600-abc123.png",
    "width": 1920,
    "height": 1080,
    "file_size_bytes": 2048576,
    "signed_url": "https://storage.googleapis.com/..."
  }
}
```

### GET /api/image-materials/[id]
**説明**: 画像素材の個別取得（署名付きURL付き）

**レスポンス**: POST と同様

### PUT /api/image-materials/[id]
**説明**: 画像素材のメタデータ更新（画像ファイルは変更不可）

**リクエスト**:
```json
{
  "name": "学校背景01（更新）",
  "description": "昼間の学校の廊下（更新）",
  "category": "背景",
  "tags": ["学校", "廊下", "昼間", "明るい"]
}
```

### DELETE /api/image-materials/[id]
**説明**: 画像素材の削除（データベース + GCP Storage）

**レスポンス**:
```json
{
  "success": true,
  "message": "Image material deleted successfully"
}
```

## 使用例

### 画像素材の作成
```typescript
const formData = new FormData();
formData.append('name', '学校背景01');
formData.append('description', '昼間の学校の廊下');
formData.append('category', '背景');
formData.append('tags', JSON.stringify(['学校', '廊下', '昼間']));
formData.append('image', imageFile);

const response = await fetch('/api/image-materials', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log('Created:', data.material);
```

### 画像素材の取得
```typescript
const response = await fetch('/api/image-materials');
const data = await response.json();

data.materials.forEach(material => {
  console.log(material.name);
  console.log(material.signed_url); // 署名付きURLで画像を表示可能
});
```

### 画像素材の更新
```typescript
const response = await fetch(`/api/image-materials/1`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '学校背景01（更新）',
    description: '昼間の学校の廊下（更新）',
    category: '背景',
    tags: ['学校', '廊下', '昼間', '明るい'],
  }),
});
```

### 画像素材の削除
```typescript
const response = await fetch(`/api/image-materials/1`, {
  method: 'DELETE',
});
```

## フロントエンドコンポーネント

### `/components/master/ImageMaterialsManager.tsx`
画像素材マスタの管理画面コンポーネント

**主要機能**:
- テーブル表示（サムネイル付き）
- 画像アップロードダイアログ
- 編集ダイアログ（メタデータのみ）
- 削除確認ダイアログ
- カテゴリフィルター
- タグ入力（Autocomplete）
- ドラッグ&ドロップアップロード対応
- 画像プレビュー表示

### `/app/master/m_image_materials/page.tsx`
画像素材マスタの管理ページ

```typescript
import ImageMaterialsManager from '@/components/master/ImageMaterialsManager';

export default function ImageMaterialsPage() {
  return <ImageMaterialsManager />;
}
```

## 技術的詳細

### 画像メタデータの自動取得
Sharp ライブラリを使用して、アップロード時に画像の幅・高さを自動取得:

```typescript
import sharp from 'sharp';

const metadata = await sharp(buffer).metadata();
const width = metadata.width || null;
const height = metadata.height || null;
```

### 署名付きURLの生成
GCP Storageの署名付きURLを使用して、非公開ファイルへの一時的なアクセスを提供:

```typescript
import { getImageMaterialSignedUrl } from '@/lib/gcp-storage';

const signedUrl = await getImageMaterialSignedUrl(
  'materials/bg-school-001.png',
  120 // 2時間有効
);
```

### ファイルアップロードの処理フロー
1. クライアントがFormDataで画像とメタデータを送信
2. サーバーがファイルタイプ・サイズをバリデーション
3. Sharpで画像のメタデータを取得
4. GCP Storageにアップロード（`materials/` フォルダ）
5. データベースにメタデータを保存
6. 署名付きURLを生成してレスポンス

## 既存機能との統合

### 効果音マスタとの類似点
- 同じRLSポリシー（全員参照可能、認証済みユーザーのみ編集）
- GCP Storageにファイル保存
- カテゴリ・タグによる分類
- 専用のManagerコンポーネント

### 相違点
| 項目 | 効果音マスタ | 画像素材マスタ |
|------|------------|---------------|
| ファイル形式 | 音声（MP3, WAV） | 画像（PNG, JPG, WEBP） |
| 保存フォルダ | `audio/sound-effects/` | `materials/` |
| メタデータ | duration, file_size | width, height, file_size |
| プレビュー | 再生ボタン | サムネイル表示 |
| 編集時のファイル差し替え | 可能 | 不可（削除→再作成） |

## 今後の拡張予定

### ワークフローノードでの利用
将来的に以下のノードで画像素材マスタを参照可能にする:

- `ImageInputNode` - 素材マスタから画像を選択
- `NanobanaNode` - 参照画像として素材を選択
- `GeminiNode` - 画像認識の入力として素材を選択

### DynamicFormField での利用
`materialSelector` フィールドタイプを追加:

```typescript
{
  type: 'materialSelector',
  label: '背景素材',
  name: 'backgroundMaterialId',
  category: '背景', // カテゴリでフィルター
  maxSelections: 1
}
```

## トラブルシューティング

### 画像がアップロードできない
**問題**: "File size exceeds 10MB limit" エラー

**解決策**:
- 画像を圧縮してファイルサイズを10MB以下にする
- 解像度を下げる
- フォーマットをWEBPに変換（高圧縮率）

### サムネイルが表示されない
**問題**: 署名付きURLが期限切れ

**解決策**:
- ページをリロードして新しい署名付きURLを取得
- API側で署名付きURLの有効期限を長く設定（現在は2時間）

### GCP Storageへのアップロードが失敗する
**問題**: "GCP_SERVICE_ACCOUNT_KEY environment variable is not set"

**解決策**:
- `.env.local` に `GCP_SERVICE_ACCOUNT_KEY` を設定
- サービスアカウントに Storage Admin 権限があることを確認

## 関連ドキュメント

- [DATABASE.md](/DATABASE.md) - データベーススキーマ全体
- [効果音マスタ実装](/components/master/SoundEffectsManager.tsx) - 類似実装の参考
- [CLAUDE.md](/CLAUDE.md) - 開発履歴と変更内容
