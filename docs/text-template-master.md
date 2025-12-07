# テキストテンプレートマスタ機能 設計書

## 概要

テキスト入力フォームに挿入可能なテンプレート文を管理するマスタ機能。
ワークフローのプロンプト入力時やテキスト入力時に、事前に登録したテンプレートを選択して挿入できる。

## 目的

- よく使うプロンプトやテキストパターンをテンプレートとして登録
- テンプレートをダイアログから選択してテキストフィールドに挿入
- テンプレートの新規登録・編集・削除機能
- カテゴリやタグによる分類と検索

## データベース設計

### テーブル名
`kazikastudio.m_text_templates`

### カラム定義

```sql
CREATE TABLE kazikastudio.m_text_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,                  -- テンプレート名（英語）
  name_ja VARCHAR(100),                        -- テンプレート名（日本語）
  content TEXT NOT NULL,                       -- テンプレート本文
  description TEXT,                            -- 説明（英語）
  description_ja TEXT,                         -- 説明（日本語）
  category VARCHAR(50) DEFAULT 'general',      -- カテゴリ（general, prompt, scene, character, etc.）
  tags TEXT[],                                 -- タグ配列（検索用）
  is_active BOOLEAN DEFAULT TRUE,              -- 有効フラグ
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- 作成者（NULL = 共有テンプレート）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_text_templates_category ON kazikastudio.m_text_templates(category);
CREATE INDEX idx_text_templates_user_id ON kazikastudio.m_text_templates(user_id);
CREATE INDEX idx_text_templates_tags ON kazikastudio.m_text_templates USING GIN(tags);

-- RLS ポリシー
ALTER TABLE kazikastudio.m_text_templates ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが共有テンプレート（user_id IS NULL）と自分のテンプレートを参照可能
CREATE POLICY "Allow read access to shared and own templates"
ON kazikastudio.m_text_templates
FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());

-- 認証済みユーザーは自分のテンプレートを作成可能
CREATE POLICY "Allow insert own templates"
ON kazikastudio.m_text_templates
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 自分のテンプレートのみ更新可能
CREATE POLICY "Allow update own templates"
ON kazikastudio.m_text_templates
FOR UPDATE
USING (user_id = auth.uid());

-- 自分のテンプレートのみ削除可能
CREATE POLICY "Allow delete own templates"
ON kazikastudio.m_text_templates
FOR DELETE
USING (user_id = auth.uid());
```

## API設計

### エンドポイント

既存の `/api/master-tables/[table]` を使用します。

#### 1. テンプレート一覧取得
```
GET /api/master-tables/m_text_templates
```

**レスポンス例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "anime_scene_prompt",
      "name_ja": "アニメシーンプロンプト",
      "content": "anime style, high quality, detailed background, cinematic lighting, 4K resolution",
      "description": "Standard anime scene prompt template",
      "description_ja": "標準的なアニメシーンプロンプトテンプレート",
      "category": "prompt",
      "tags": ["anime", "scene", "quality"],
      "is_active": true,
      "created_at": "2025-12-06T10:00:00Z"
    }
  ]
}
```

#### 2. テンプレート作成
```
POST /api/master-tables/m_text_templates
Content-Type: application/json

{
  "name": "character_intro",
  "name_ja": "キャラクター紹介",
  "content": "こんにちは！私は{{name}}です。{{description}}",
  "description": "Character introduction template",
  "description_ja": "キャラクター紹介テンプレート",
  "category": "character",
  "tags": ["character", "intro"]
}
```

#### 3. テンプレート更新
```
PUT /api/master-tables/m_text_templates
Content-Type: application/json

{
  "id": 1,
  "name": "anime_scene_prompt",
  "content": "...",
  ...
}
```

#### 4. テンプレート削除
```
DELETE /api/master-tables/m_text_templates?id=1
```

## UIコンポーネント設計

### 1. TextTemplateManager.tsx
**場所**: `/components/master/TextTemplateManager.tsx`

**機能**:
- テンプレート一覧表示（テーブル形式）
- カテゴリフィルター
- タグ検索
- 新規作成ダイアログ
- 編集ダイアログ
- 削除確認ダイアログ

**主要プロパティ**:
```typescript
interface TextTemplate {
  id: number;
  name: string;
  name_ja?: string;
  content: string;
  description?: string;
  description_ja?: string;
  category: string;
  tags: string[];
  is_active: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}
```

### 2. DynamicFormField.tsx への追加
**場所**: `/components/form/DynamicFormField.tsx`

**新しいフィールドタイプ**: `templates`

**機能**:
- テンプレート選択ボタンを表示
- クリックでテンプレート選択ダイアログを開く
- カテゴリフィルター、タグ検索
- テンプレートをクリックでターゲットフィールドに挿入
- 挿入モード: 置換（replace）、追記（append）、プレフィックス（prepend）

**使用例（formConfigGenerator.ts）**:
```typescript
{
  type: 'templates',
  name: 'templateInsert',
  label: 'テンプレート挿入',
  required: false,
  targetFieldName: 'prompt',  // 挿入先のフィールド名
  category: 'prompt',          // フィルタするカテゴリ（省略可）
  insertMode: 'append',        // 挿入モード: 'replace' | 'append' | 'prepend'
  helperText: 'クリックしてプロンプトテンプレートを挿入',
}
```

## 実装手順

### Phase 1: データベース準備 ✅ 完了
1. ✅ マイグレーションファイル作成
   - `/supabase/migrations/20251206014713_create_text_templates.sql`
2. ✅ `/lib/db.ts` への関数追加（既存のマスタテーブル関数を使用）

### Phase 2: API実装 ✅ 完了
1. ✅ `/app/api/master-tables/[table]/route.ts` に `m_text_templates` を追加（ALLOWED_TABLESに追加）
2. ✅ 既存のマスタテーブル関数で対応可能（特別な処理不要）

### Phase 3: マスタ管理UI ✅ 完了
1. ✅ `/components/master/TextTemplateManager.tsx` 作成
   - `MasterTableManager.tsx` をベースに拡張
   - カテゴリフィルター追加
   - タグ入力・表示機能追加
   - contentフィールドの表示（multiline）

2. ✅ `/app/master/m_text_templates/page.tsx` 作成
   - TextTemplateManagerを呼び出し

3. ✅ `/app/master/page.tsx` に「テキストテンプレート」カードを追加

### Phase 4: テンプレート挿入機能 ✅ 完了
1. ✅ `/components/form/DynamicFormField.tsx` に `templates` タイプを追加
   - テンプレート選択ボタン
   - ダイアログUI（検索、カテゴリフィルター）
   - 挿入処理（replace/append/prepend）

2. 📋 `/lib/workflow/formConfigGenerator.ts` のノード設定に追加（今後の拡張）
   - Gemini, Nanobana, ElevenLabsなどのprompt/textフィールドの下に配置
   - 現時点では `/form` ページで手動で設定可能

## カテゴリ例

- `general` - 汎用テンプレート
- `prompt` - 画像生成プロンプト
- `scene` - シーン描写
- `character` - キャラクターセリフ
- `narration` - ナレーション
- `system` - システムプロンプト

## 挿入モード

### replace（置換）
ターゲットフィールドの内容を完全に置き換え
```
元: "Hello"
テンプレート: "Goodbye"
結果: "Goodbye"
```

### append（追記）
ターゲットフィールドの末尾に追加
```
元: "Hello"
テンプレート: " World"
結果: "Hello World"
```

### prepend（プレフィックス）
ターゲットフィールドの先頭に追加
```
元: "World"
テンプレート: "Hello "
結果: "Hello World"
```

## 変数機能（将来拡張）

テンプレート内で `{{変数名}}` を使用可能にする
```
テンプレート: "こんにちは、{{name}}さん！"
変数置換後: "こんにちは、カジカさん！"
```

## 既存機能との統合

### ElevenLabs Tags との違い
- **ElevenLabs Tags**: 短い固定タグ（`[friendly]`, `[sad]`など）
  - タグ名のみをテキストに挿入
  - 感情表現に特化

- **Text Templates**: 長文のテンプレート文
  - テンプレート本文全体を挿入
  - プロンプト、セリフ、シーン描写など汎用的

### 使用シーン
1. **画像生成プロンプト**
   - "anime style, high quality, detailed..."

2. **キャラクターセリフ**
   - "やあ！元気してた？最近{{topic}}について考えていてね..."

3. **シーン描写**
   - "夕暮れ時の学校の屋上。オレンジ色の空が広がり..."

## 技術仕様

### フロントエンド
- **React Hooks**: useState, useEffect
- **Material-UI**: Dialog, TextField, Chip, Table
- **検索機能**: リアルタイムフィルタリング
- **カテゴリフィルター**: Chipによる選択

### バックエンド
- **Next.js API Routes**: App Router形式
- **Supabase**: PostgreSQL + RLS
- **認証**: Supabase Auth（user_id）

### データフロー
```
1. ユーザーがテンプレートボタンをクリック
   ↓
2. ダイアログが開き、GET /api/master-tables/m_text_templates でデータ取得
   ↓
3. カテゴリフィルター、検索でフィルタリング
   ↓
4. テンプレートをクリック
   ↓
5. insertModeに応じてターゲットフィールドに挿入
   ↓
6. onFieldChange() でフォーム値を更新
```

## エラーハンドリング

- API通信エラー → トースト通知
- バリデーションエラー → フィールド下にエラー表示
- 削除失敗 → 確認ダイアログで通知

## パフォーマンス最適化

- テンプレート一覧は初回ロード時のみ取得
- 検索・フィルタリングはクライアントサイドで実行
- ダイアログを閉じてもデータをキャッシュ

## セキュリティ

- RLSポリシーで自分のテンプレートのみ編集・削除可能
- 共有テンプレート