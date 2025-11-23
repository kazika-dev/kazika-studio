# シーンキャラクター選択機能

## 概要

ストーリーシーン（`story_scenes`）に登場するキャラクターを複数選択・管理できる機能を実装しました。これにより、シーンごとに登場キャラクターを定義し、会話生成時に自動的にそれらのキャラクターを選択できるようになります。

---

## 主な機能

### 1. **シーンに複数のキャラクターを登録**
- シーンごとに登場するキャラクターを複数選択
- キャラクターの表示順序を管理（`display_order`）
- メインキャラクターの指定（`is_main_character`）

### 2. **会話生成時の自動選択**
- シーンに登録されたキャラクターが会話生成ダイアログで自動的に選択状態になる
- ユーザーは追加で他のキャラクターを選ぶことも可能

### 3. **キャラクター管理UI**
- キャラクターの追加・削除
- メインキャラクターフラグの切り替え（⭐アイコン）
- ドラッグ&ドロップでの順序変更（将来実装予定）

---

## データベース設計

### テーブル: `kazikastudio.story_scene_characters`

```sql
CREATE TABLE kazikastudio.story_scene_characters (
  id BIGSERIAL PRIMARY KEY,
  story_scene_id BIGINT NOT NULL REFERENCES kazikastudio.story_scenes(id) ON DELETE CASCADE,
  character_sheet_id BIGINT NOT NULL REFERENCES kazikastudio.character_sheets(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 1,
  is_main_character BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (story_scene_id, character_sheet_id)
);
```

### フィールド説明

| フィールド | 型 | 説明 |
|-----------|---|------|
| `id` | BIGSERIAL | 主キー |
| `story_scene_id` | BIGINT | シーンID（外部キー） |
| `character_sheet_id` | BIGINT | キャラクターシートID（外部キー） |
| `display_order` | INT | 表示順序（1から開始） |
| `is_main_character` | BOOLEAN | メインキャラクターフラグ |
| `metadata` | JSONB | 追加メタデータ |

### インデックス

```sql
-- シーンIDでの検索
CREATE INDEX idx_story_scene_characters_scene_id ON story_scene_characters(story_scene_id);

-- キャラクターIDでの検索
CREATE INDEX idx_story_scene_characters_character_id ON story_scene_characters(character_sheet_id);

-- 表示順序でのソート
CREATE INDEX idx_story_scene_characters_display_order ON story_scene_characters(story_scene_id, display_order);
```

### RLSポリシー

ユーザーは自分のストーリーに属するシーンのキャラクターのみ閲覧・編集可能：

```sql
CREATE POLICY "Users can view characters in their scenes"
  ON kazikastudio.story_scene_characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = story_scene_characters.story_scene_id
      AND s.user_id = auth.uid()
    )
  );
```

---

## バックエンド実装

### データベースヘルパー関数（`/lib/db.ts`）

#### 1. シーンのキャラクター一覧を取得

```typescript
export async function getSceneCharacters(sceneId: number)
```

**戻り値**: キャラクター詳細を含む配列

#### 2. シーンにキャラクターを追加

```typescript
export async function addCharacterToScene(
  sceneId: number,
  characterId: number,
  options?: {
    displayOrder?: number;
    isMainCharacter?: boolean;
  }
)
```

**機能**:
- 既存の最大 `display_order` を取得して自動的に最後に追加
- `ON CONFLICT` で既存の場合は更新（重複防止）

#### 3. シーンからキャラクターを削除

```typescript
export async function removeCharacterFromScene(sceneId: number, characterId: number)
```

#### 4. メインキャラクターフラグを更新

```typescript
export async function updateSceneMainCharacter(
  sceneId: number,
  characterId: number,
  isMain: boolean
)
```

#### 5. 表示順序を一括更新（将来実装）

```typescript
export async function updateSceneCharacterOrder(
  sceneId: number,
  characterOrders: Array<{ characterId: number; displayOrder: number }>
)
```

---

## API エンドポイント

### `GET /api/scenes/[id]/characters`

シーンに登録されているキャラクター一覧を取得

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "characters": [
      {
        "id": 1,
        "story_scene_id": 10,
        "character_sheet_id": 5,
        "character_name": "主人公",
        "image_url": "https://...",
        "description": "...",
        "display_order": 1,
        "is_main_character": true
      }
    ]
  }
}
```

### `POST /api/scenes/[id]/characters`

シーンにキャラクターを追加

**リクエスト**:
```json
{
  "characterId": 5,
  "displayOrder": 1,
  "isMainCharacter": true
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "sceneCharacter": { /* StorySceneCharacter */ }
  }
}
```

### `DELETE /api/scenes/[id]/characters?characterId=X`

シーンからキャラクターを削除

### `PATCH /api/scenes/[id]/characters`

メインキャラクターフラグを更新

**リクエスト**:
```json
{
  "characterId": 5,
  "isMainCharacter": true
}
```

---

## UIコンポーネント

### `SceneCharacterSelector.tsx`

シーンに登場するキャラクターを管理するコンポーネント

**Props**:
```typescript
interface SceneCharacterSelectorProps {
  sceneId: number;         // シーンID
  onUpdate?: () => void;   // キャラクター更新時のコールバック
}
```

**機能**:
- ✅ キャラクター一覧表示（アバター、名前、説明）
- ✅ キャラクター追加ダイアログ
- ✅ キャラクター削除ボタン
- ✅ メインキャラクターフラグの切り替え（⭐アイコン）
- ✅ ドラッグハンドル表示（順序変更は将来実装）
- ✅ エラーメッセージ表示
- ✅ ローディング状態

**使用例**:
```tsx
import SceneCharacterSelector from '@/components/studio/conversation/SceneCharacterSelector';

<SceneCharacterSelector
  sceneId={sceneId}
  onUpdate={() => {
    // キャラクター更新時の処理
    console.log('Characters updated');
  }}
/>
```

---

## 会話生成との連携

### `ConversationGeneratorDialogWithScene.tsx` の拡張

シーンに登録されたキャラクターを会話生成ダイアログで自動選択：

```typescript
const loadSceneCharacters = async () => {
  if (!sceneId) return;

  try {
    const response = await fetch(`/api/scenes/${sceneId}/characters`);
    const result = await response.json();

    if (result.success && result.data?.characters) {
      // シーンに登録されたキャラクターIDを自動選択
      const sceneCharacterIds = result.data.characters.map(c => c.character_sheet_id);
      setSelectedCharacters(sceneCharacterIds);
    }
  } catch (error) {
    console.error('Failed to load scene characters:', error);
  }
};
```

**データフロー**:
1. ユーザーが「会話を生成」をクリック
2. `ConversationGeneratorDialogWithScene` が開く
3. `sceneId` に基づいてシーンキャラクターを取得
4. キャラクター選択が自動的に完了した状態でダイアログを表示
5. ユーザーは追加で他のキャラクターを選択可能
6. 会話生成APIを呼び出し

---

## 型定義（`/types/conversation.ts`）

### `StorySceneCharacter`

```typescript
export interface StorySceneCharacter {
  id: number;
  story_scene_id: number;
  character_sheet_id: number;
  display_order: number;
  is_main_character: boolean;
  created_at: string;
  metadata: Record<string, any>;
}
```

### `StorySceneCharacterWithDetails`

```typescript
export interface StorySceneCharacterWithDetails extends StorySceneCharacter {
  character_id: number;
  character_name: string;
  image_url: string | null;
  description: string | null;
  personality: string | null;
  speaking_style: string | null;
  sample_dialogues: Array<{
    situation: string;
    line: string;
  }>;
}
```

### `StorySceneWithCharacters`

```typescript
export interface StorySceneWithCharacters extends StoryScene {
  characters?: StorySceneCharacterWithDetails[];
}
```

---

## 使用例

### シナリオ: 「屋上での告白シーン」

#### 1. シーンにキャラクターを登録

```
登場キャラクター:
- 主人公（太郎）⭐ メイン
- ヒロイン（花子）⭐ メイン
- 親友（次郎）
```

#### 2. 会話生成

「会話を生成」をクリックすると、自動的に3人が選択された状態でダイアログが開く：

```
✓ 主人公（太郎）
✓ ヒロイン（花子）
✓ 親友（次郎）
□ 先生
□ その他のキャラクター
```

#### 3. 生成された会話

```
主人公: [serious] 実は話があるんだ...
ヒロイン: [surprised] えっ、何？
親友: [friendly] 俺は少し離れてるよ。
主人公: [emotional] 君のことが...好きだ！
ヒロイン: [happy] 私も...ずっと待ってた！
```

---

## 制限事項と推奨事項

### 技術的制限

- **最大キャラクター数**: 技術的には無制限だが、実用上は5人程度を推奨
- **会話生成**: 2～5人のキャラクターが最適（多すぎると会話が複雑化）
- **画像生成**: Nanobanaノードは最大4人まで対応

### 推奨事項

- **メインキャラクター**: 1～2人を推奨
- **サブキャラクター**: 必要に応じて追加
- **表示順序**: メインキャラクターを先頭に配置

---

## 今後の拡張案

### 1. ドラッグ&ドロップでの順序変更

`@dnd-kit/core` を使用してキャラクターの表示順序を変更可能に：

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// ドラッグ終了時
const handleDragEnd = (event) => {
  const { active, over } = event;
  if (active.id !== over.id) {
    // 順序を更新
    updateSceneCharacterOrder(sceneId, newOrders);
  }
};
```

### 2. シーン詳細ページ

専用のシーン詳細ページを作成し、以下の機能を統合：
- キャラクター管理（SceneCharacterSelector）
- シーン説明の編集
- 会話一覧表示
- シーンプレビュー

### 3. キャラクター役割の定義

`metadata` にキャラクターの役割を保存：

```json
{
  "role": "protagonist",  // 主人公
  "importance": "main",   // メイン/サブ
  "sceneEntry": 0,        // シーン開始時から登場
  "sceneExit": null       // 途中退場なし
}
```

### 4. 画像生成時の自動適用

Nanobanaノードでシーンキャラクターのみを画像生成に使用：

```typescript
// /lib/workflow/executor.ts のNanobanaケース
const sceneCharacters = await getSceneCharacters(sceneId);
const characterSheetIds = sceneCharacters.map(c => c.character_sheet_id);

// selectedCharacterSheetIds として使用
config.selectedCharacterSheetIds = characterSheetIds;
```

---

## トラブルシューティング

### キャラクターが自動選択されない

**原因**: `sceneId` が正しく渡されていない

**解決策**:
```typescript
// ConversationGeneratorDialogWithScene のコンソールログを確認
console.log('[ConversationGenerator] Auto-selected scene characters:', sceneCharacterIds);
```

### 重複エラー

**原因**: 同じキャラクターを2回追加しようとした

**解決策**: UNIQUEキー制約により、既存の場合は自動的に更新される（`ON CONFLICT DO UPDATE`）

### 所有権エラー

**原因**: 他のユーザーのシーンにキャラクターを追加しようとした

**解決策**: RLSポリシーが正しく動作している証拠。シーンの所有者のみが編集可能。

---

## まとめ

シーンキャラクター選択機能により、以下のことが可能になりました：

✅ **シーンごとに登場キャラクターを管理**
✅ **会話生成時にシーンキャラクターを自動選択**
✅ **メインキャラクターの明示的な指定**
✅ **多対多の関係（1シーン→複数キャラ、1キャラ→複数シーン）**
✅ **完全なRLSポリシーによる所有権管理**

この機能は、CLAUDE.mdの原則（一元管理、データベース駆動、後方互換性）に従って実装されており、将来の拡張も容易です。
