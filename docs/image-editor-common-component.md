# ImageEditor 共通コンポーネント化

## 概要

`/components/outputs/ImageEditor.tsx` を `/components/common/ImageEditor.tsx` に移動し、プロジェクト全体で再利用可能な共通コンポーネントとして実装しました。

## 変更内容

### ファイル移動

- **変更前**: `/components/outputs/ImageEditor.tsx`
- **変更後**: `/components/common/ImageEditor.tsx`

### Props インターフェースの変更

**変更前**（output 固有の依存あり）:
```typescript
interface ImageEditorProps {
  imageUrl: string;
  originalOutputId?: string;  // output 固有
  onSave?: (imageBlob: Blob) => void;
  onClose?: () => void;
}
```

**変更後**（汎用化）:
```typescript
interface ImageEditorProps {
  imageUrl: string;
  onSave?: (imageBlob: Blob) => void | Promise<void>;  // async 対応
  onClose?: () => void;
  disableDefaultSave?: boolean;  // デフォルト保存を無効化
}
```

### 削除された機能

1. **`originalOutputId` プロップ**: output 固有の機能のため削除
2. **`useRouter` インポート**: ナビゲーション処理を削除したため不要
3. **デフォルト保存処理**: `/api/outputs/save-edited` へのハードコードされた POST リクエストを削除

### 変更された機能

#### `handleSave` 関数（888-916行目）

**変更前**:
```typescript
const handleSave = async () => {
  // ... canvas から blob を生成 ...

  // デフォルト保存処理（output 固有）
  const formData = new FormData();
  formData.append('image', blob);
  if (originalOutputId) {
    formData.append('originalOutputId', originalOutputId);
  }
  const response = await fetch('/api/outputs/save-edited', {
    method: 'POST',
    body: formData,
  });

  if (onSave) {
    onSave(blob);
  }
  router.push('/outputs');  // ハードコードされたナビゲーション
};
```

**変更後**:
```typescript
const handleSave = async () => {
  // ... canvas から blob を生成 ...

  if (!onSave && !disableDefaultSave) {
    alert('保存処理が設定されていません');
    return;
  }

  // 完全に親コンポーネントの制御下
  if (onSave) {
    await onSave(blob);
  }

  // 成功時のナビゲーションも親に委譲
  if (onClose) {
    onClose();
  }
};
```

## 使用方法

### 既存の outputs ページでの使用（変更なし）

`/app/outputs/edit/[id]/page.tsx` で引き続き使用可能。import パスのみ変更:

```typescript
import ImageEditor from '@/components/common/ImageEditor';

export default function EditOutputPage() {
  // ... output を取得 ...

  return (
    <ImageEditor
      imageUrl={getImageSrc(output.content_url)}
      onSave={async (blob) => {
        const formData = new FormData();
        formData.append('image', blob);
        formData.append('originalOutputId', id);
        const response = await fetch('/api/outputs/save-edited', {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          router.push('/outputs');
        }
      }}
    />
  );
}
```

### 新しい用途（m_image_materials）での使用

```typescript
import ImageEditor from '@/components/common/ImageEditor';

// ImageMaterialsManager.tsx
export default function ImageMaterialsManager() {
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<ImageMaterial | null>(null);

  const handleSaveEditedImage = async (blob: Blob) => {
    if (!selectedMaterial) return;

    const formData = new FormData();
    formData.append('image', blob);

    const response = await fetch(
      `/api/image-materials/${selectedMaterial.id}/replace-image`,
      {
        method: 'PUT',
        body: formData,
      }
    );

    if (response.ok) {
      toast.success('画像を更新しました');
      setImageEditorOpen(false);
      setEditingImageUrl(null);
      loadMaterials();
    }
  };

  return (
    <>
      {/* テーブルの操作列に筆アイコンボタンを追加 */}
      <IconButton
        onClick={() => {
          setSelectedMaterial(material);
          setEditingImageUrl(material.signed_url || '');
          setImageEditorOpen(true);
        }}
        color="secondary"
        title="画像を編集"
      >
        <BrushIcon />
      </IconButton>

      {/* 画像エディタ */}
      {imageEditorOpen && editingImageUrl && (
        <ImageEditor
          imageUrl={editingImageUrl}
          onSave={handleSaveEditedImage}
          onClose={() => {
            setImageEditorOpen(false);
            setEditingImageUrl(null);
          }}
        />
      )}
    </>
  );
}
```

### 画像差し替えAPIエンドポイント

`/app/api/image-materials/[id]/replace-image/route.ts` を新規作成:

**機能**:
- 既存の画像を GCP Storage から削除
- 新しい画像（Canvas で編集された画像）をアップロード
- Sharp で画像メタデータ（width, height）を自動取得
- データベースの `m_image_materials` テーブルを更新

**技術的詳細**:
```typescript
// 遅延初期化パターン（ビルド時エラー回避）
let storage: Storage | null = null;

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID!,
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL!,
        private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
      },
    });
  }
  return storage;
}

export async function PUT(request, context) {
  // ... 認証チェック ...

  // 既存画像を削除
  await bucket.file(existingMaterial.storage_path).delete();

  // 新しい画像をアップロード
  await bucket.file(storagePath).save(buffer);

  // データベースを更新
  await supabase
    .from('m_image_materials')
    .update({
      storage_path: storagePath,
      width,
      height,
      file_size_bytes: imageFile.size,
    })
    .eq('id', id);
}
```

## 技術的詳細

### 完全に制御された（Controlled）コンポーネント

- `ImageEditor` は内部で保存処理を持たず、すべて `onSave` プロップ経由で親に委譲
- ナビゲーション処理も `onClose` プロップ経由で親に委譲
- これにより、異なるコンテキストで異なる保存・ナビゲーション処理を実装可能

### 後方互換性

- 既存の `/app/outputs/edit/[id]/page.tsx` は引き続き動作
- import パスのみ変更すれば OK

### 今後の拡張可能性

- ✅ `/app/master/m_image_materials` で画像素材の編集に使用可能（実装済み）
- キャラクターシートの画像編集
- 会話シーンの画像編集
- その他、任意の画像編集タスクに再利用可能

## 影響範囲

### 更新されたファイル

1. **`/components/common/ImageEditor.tsx`** - 新しい共通コンポーネント（元: `/components/outputs/ImageEditor.tsx`）
2. **`/app/outputs/edit/[id]/page.tsx`** - import パスを更新
3. **`/components/master/ImageMaterialsManager.tsx`** - ImageEditor統合、筆アイコンボタン追加
4. **`/app/api/image-materials/[id]/replace-image/route.ts`** - 画像差し替えAPIエンドポイント（新規）
5. **`/docs/image-editor-text-feature-fix.md`** - ファイルパスを更新
6. **`/docs/image-editor-common-component.md`** - 新規ドキュメント（本ファイル）
7. **`/workspaces/kazika-studio/CLAUDE.md`** - プロジェクトメモに追記

### 削除されたファイル

- `/components/outputs/ImageEditor.tsx` - `/components/common/ImageEditor.tsx` に移動

## 参考情報

- 元の機能修正: [/docs/image-editor-text-feature-fix.md](/docs/image-editor-text-feature-fix.md)
- React Controlled Components: https://react.dev/learn/sharing-state-between-components
