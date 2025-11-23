# メッセージごとのシーンキャラクターシート設定機能

## 概要

`conversation_messages` テーブルの各メッセージ（シーンプロンプト）ごとに、登場人物のキャラクターシートを複数設定できる機能を追加します。

## 背景

現在の実装では：
- `conversation_messages` テーブルに `scene_prompt_ja` と `scene_prompt_en` が保存されている
- 各メッセージには `character_id` が1つだけ設定されている（話者）
- しかし、シーンプロンプトには複数のキャラクターが登場する可能性がある

### 例：
```json
{
  "speaker": "カジカ",
  "message": "ふふ、ありがとうね。でも、メスガキちゃんも無理はしないでね？さあ、そろそろ帰ろうか。",
  "scene": "カジカは優しい笑顔でメスガキに語りかけ、二人に歩み寄る。夕焼けの中、３人で並んで歩き出す。",
  "scenePromptJa": "女子高生が優しい笑顔で少女に話しかけ、寄り添うように歩き出す。夕焼けの帰り道。穏やかな空気が流れている。"
}
```

この例では：
- 話者は「カジカ」（`character_id` = 13）
- しかし、シーンには「カジカ」「メスガキ」「ミオ」の3人が登場している
- 画像生成時には3人分のキャラクターシートが必要

## 要件

### 機能要件
1. **メッセージごとに複数のキャラクターシートを設定可能**
   - 1つのメッセージに対して0個以上のキャラクターシートを登録
   - 話者（`character_id`）とは別に、シーンに登場するキャラクターを管理

2. **AIによる自動判定・登録**
   - 会話生成時にGemini AIが各メッセージの `scenePromptJa`/`scenePromptEn` を見て、登場キャラクターを判定
   - 判定されたキャラクターを自動的に登録

3. **手動での編集**
   - UIでメッセージごとに登場キャラクターを追加・削除可能
   - 既存のメッセージにも後から設定可能

4. **画像生成への活用**
   - Nanobanaノード実行時、メッセージに紐づくキャラクターシートを自動取得
   - 最大4枚までのキャラクターシートを画像生成APIに送信

## データベース設計

### 新規テーブル: `conversation_message_characters`

```sql
CREATE TABLE kazikastudio.conversation_message_characters (
  id BIGSERIAL PRIMARY KEY,
  conversation_message_id BIGINT NOT NULL
    REFERENCES kazikastudio.conversation_messages(id) ON DELETE CASCADE,
  character_sheet_id BIGINT NOT NULL
    REFERENCES kazikastudio.character_sheets(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (conversation_message_id, character_sheet_id)
);

CREATE INDEX idx_message_characters_message_id
  ON kazikastudio.conversation_message_characters(conversation_message_id);
CREATE INDEX idx_message_characters_character_id
  ON kazikastudio.conversation_message_characters(character_sheet_id);
```

### 特徴
- **多対多の関係**: 1つのメッセージに複数のキャラクター、1つのキャラクターが複数のメッセージに登場
- **display_order**: キャラクターシートの優先順位（画像生成時に左から順に配置）
- **UNIQUE制約**: 同じメッセージに同じキャラクターを重複登録できない
- **CASCADE削除**: メッセージまたはキャラクターシートが削除されると、自動的に関連レコードも削除

### RLSポリシー

```sql
ALTER TABLE kazikastudio.conversation_message_characters ENABLE ROW LEVEL SECURITY;

-- SELECT: ユーザーが所有する会話のメッセージに紐づくキャラクターを閲覧可能
CREATE POLICY "Users can view message characters in their conversations"
  ON kazikastudio.conversation_message_characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_characters.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- INSERT/UPDATE/DELETE: 同様のロジック
```

## バックエンド実装

### 1. データベースヘルパー関数 (`/lib/db.ts`)

```typescript
/**
 * Get all characters associated with a conversation message
 */
export async function getMessageCharacters(
  messageId: number
): Promise<StorySceneCharacterWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversation_message_characters')
    .select(`
      id,
      conversation_message_id,
      character_sheet_id,
      display_order,
      created_at,
      metadata,
      character_sheets:character_sheet_id (
        id,
        name,
        image_url,
        description,
        personality,
        speaking_style
      )
    `)
    .eq('conversation_message_id', messageId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Add a character to a conversation message
 */
export async function addCharacterToMessage(
  messageId: number,
  characterId: number,
  options?: { displayOrder?: number }
): Promise<void> {
  const supabase = await createClient();

  // Get current max display_order
  const { data: existing } = await supabase
    .from('conversation_message_characters')
    .select('display_order')
    .eq('conversation_message_id', messageId)
    .order('display_order', { ascending: false })
    .limit(1);

  const displayOrder = options?.displayOrder ?? (existing?.[0]?.display_order ?? 0) + 1;

  const { error } = await supabase
    .from('conversation_message_characters')
    .insert({
      conversation_message_id: messageId,
      character_sheet_id: characterId,
      display_order: displayOrder
    });

  if (error) throw error;
}

/**
 * Remove a character from a conversation message
 */
export async function removeCharacterFromMessage(
  messageId: number,
  characterId: number
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('conversation_message_characters')
    .delete()
    .eq('conversation_message_id', messageId)
    .eq('character_sheet_id', characterId);

  if (error) throw error;
}

/**
 * Update character display order in a message
 */
export async function updateMessageCharacterOrder(
  messageId: number,
  characterOrders: Array<{ characterId: number; displayOrder: number }>
): Promise<void> {
  const supabase = await createClient();

  for (const { characterId, displayOrder } of characterOrders) {
    const { error } = await supabase
      .from('conversation_message_characters')
      .update({ display_order: displayOrder })
      .eq('conversation_message_id', messageId)
      .eq('character_sheet_id', characterId);

    if (error) throw error;
  }
}
```

### 2. 型定義 (`/types/conversation.ts`)

```typescript
// メッセージキャラクター関連の型
export interface ConversationMessageCharacter {
  id: number;
  conversation_message_id: number;
  character_sheet_id: number;
  display_order: number;
  created_at: string;
  metadata: Record<string, any>;
}

export interface ConversationMessageCharacterWithDetails extends ConversationMessageCharacter {
  character_sheets: {
    id: number;
    name: string;
    image_url: string | null;
    description: string | null;
    personality: string | null;
    speaking_style: string | null;
  };
}

export interface ConversationMessageWithCharacters extends ConversationMessage {
  character?: {
    id: number;
    name: string;
    image_url: string | null;
  } | null;
  scene_characters?: ConversationMessageCharacterWithDetails[]; // 追加
}

// AI応答の型を拡張
export interface GeneratedMessage {
  speakerId?: number;
  speaker?: string;
  message: string;
  emotion?: 'happy' | 'sad' | 'angry' | 'neutral' | 'surprised' | 'excited' | 'confused';
  emotionTag?: 'emotional' | 'calm' | 'energetic' | 'professional' | 'friendly' | 'serious';
  scene?: string;
  scenePromptJa?: string;
  scenePromptEn?: string;
  sceneCharacterIds?: number[]; // 追加：シーンに登場するキャラクターID
}
```

### 3. API エンドポイント

#### `/api/conversations/messages/[id]/characters/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getMessageCharacters,
  addCharacterToMessage,
  removeCharacterFromMessage,
  updateMessageCharacterOrder
} from '@/lib/db';

/**
 * GET /api/conversations/messages/[id]/characters
 * List all characters in a message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = parseInt(params.id, 10);
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Ownership check via conversation
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        conversations:conversation_id (
          id,
          studio_id,
          story_scene_id,
          studios:studio_id (user_id),
          story_scenes:story_scene_id (
            story_id,
            stories:story_id (user_id)
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    // Check ownership
    const conversation = message.conversations as any;
    const isOwner =
      (conversation.studios?.user_id === user.id) ||
      (conversation.story_scenes?.stories?.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const characters = await getMessageCharacters(messageId);

    return NextResponse.json({
      success: true,
      data: { characters }
    });
  } catch (error) {
    console.error('[GET /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/messages/[id]/characters
 * Add a character to the message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = parseInt(params.id, 10);
    const body = await request.json();
    const { characterId, displayOrder } = body;

    // (Similar auth/ownership checks as GET)

    await addCharacterToMessage(messageId, characterId, { displayOrder });

    return NextResponse.json({
      success: true,
      data: { message: 'Character added to message' }
    });
  } catch (error) {
    console.error('[POST /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/messages/[id]/characters?characterId=X
 * Remove a character from the message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = parseInt(params.id, 10);
    const { searchParams } = new URL(request.url);
    const characterId = parseInt(searchParams.get('characterId') || '0', 10);

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: 'characterId is required' },
        { status: 400 }
      );
    }

    // (Similar auth/ownership checks as GET)

    await removeCharacterFromMessage(messageId, characterId);

    return NextResponse.json({
      success: true,
      data: { message: 'Character removed from message' }
    });
  } catch (error) {
    console.error('[DELETE /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/messages/[id]/characters
 * Update character order
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = parseInt(params.id, 10);
    const body = await request.json();
    const { characterOrders } = body; // [{ characterId, displayOrder }]

    // (Similar auth/ownership checks as GET)

    await updateMessageCharacterOrder(messageId, characterOrders);

    return NextResponse.json({
      success: true,
      data: { message: 'Character order updated' }
    });
  } catch (error) {
    console.error('[PATCH /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## AI自動判定の実装

### 1. プロンプト修正 (`/lib/conversation/prompt-builder.ts`)

```typescript
// buildConversationPrompt() の出力形式セクションを修正
{
  "characterIds": [このシーンに登場する全てのキャラクターIDの配列],
  "messages": [
    {
      "speakerId": キャラクターID（話者）,
      "message": "セリフ内容",
      "emotion": "happy|sad|angry|neutral|surprised|excited|confused",
      "emotionTag": "感情タグ",
      "scene": "場面描写",
      "scenePromptJa": "日本語シーンプロンプト",
      "scenePromptEn": "英語シーンプロンプト",
      "sceneCharacterIds": [このメッセージのシーンに登場するキャラクターIDの配列] // 追加
    }
  ]
}
```

### 2. 会話生成API修正 (`/app/api/conversations/generate/route.ts`)

メッセージ保存後、各メッセージの `sceneCharacterIds` を `conversation_message_characters` に登録：

```typescript
// After inserting messages (around line 305)
// Register scene characters to each message
for (let idx = 0; idx < insertedMessages.length; idx++) {
  const msg = parsed.messages[idx];
  const insertedMsg = insertedMessages[idx];

  if (msg.sceneCharacterIds && msg.sceneCharacterIds.length > 0) {
    console.log(
      `[Generate Conversation] Registering ${msg.sceneCharacterIds.length} characters to message ${insertedMsg.id}`
    );

    for (let i = 0; i < msg.sceneCharacterIds.length; i++) {
      const characterId = msg.sceneCharacterIds[i];
      try {
        await addCharacterToMessage(insertedMsg.id, characterId, { displayOrder: i + 1 });
        console.log(
          `[Generate Conversation] Registered character ${characterId} to message ${insertedMsg.id}`
        );
      } catch (error) {
        console.error(
          `[Generate Conversation] Failed to register character ${characterId} to message ${insertedMsg.id}:`,
          error
        );
        // Continue with other characters
      }
    }
  }
}
```

## UI実装

### 1. メッセージキャラクター管理コンポーネント

`/components/studio/conversation/MessageCharacterSelector.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface MessageCharacterSelectorProps {
  messageId: number;
  availableCharacters: Array<{ id: number; name: string; image_url: string | null }>;
  onUpdate?: () => void;
}

export default function MessageCharacterSelector({
  messageId,
  availableCharacters,
  onUpdate
}: MessageCharacterSelectorProps) {
  const [characters, setCharacters] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, [messageId]);

  const loadCharacters = async () => {
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}/characters`);
      const result = await response.json();
      if (result.success) {
        setCharacters(result.data.characters || []);
      }
    } catch (error) {
      console.error('Failed to load message characters:', error);
    }
  };

  const handleAddCharacter = async (characterId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId })
      });

      if (response.ok) {
        await loadCharacters();
        setDialogOpen(false);
        onUpdate?.();
      }
    } catch (error) {
      console.error('Failed to add character:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCharacter = async (characterId: number) => {
    try {
      const response = await fetch(
        `/api/conversations/messages/${messageId}/characters?characterId=${characterId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await loadCharacters();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Failed to remove character:', error);
    }
  };

  const selectedIds = characters.map(c => c.character_sheet_id);
  const availableToAdd = availableCharacters.filter(c => !selectedIds.includes(c.id));

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      {characters.map(char => (
        <Box key={char.id} sx={{ position: 'relative' }}>
          <Avatar
            src={char.character_sheets?.image_url || undefined}
            alt={char.character_sheets?.name}
            sx={{ width: 40, height: 40 }}
          />
          <IconButton
            size="small"
            onClick={() => handleRemoveCharacter(char.character_sheet_id)}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: 'error.main',
              color: 'white',
              width: 20,
              height: 20,
              '&:hover': { bgcolor: 'error.dark' }
            }}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      ))}
      <IconButton
        onClick={() => setDialogOpen(true)}
        disabled={availableToAdd.length === 0}
        sx={{ border: '1px dashed', borderRadius: '50%', width: 40, height: 40 }}
      >
        <AddIcon />
      </IconButton>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>シーンキャラクターを追加</DialogTitle>
        <DialogContent>
          <List>
            {availableToAdd.map(char => (
              <ListItem key={char.id} disablePadding>
                <ListItemAvatar>
                  <Avatar src={char.image_url || undefined} alt={char.name} />
                </ListItemAvatar>
                <ListItemText primary={char.name} />
                <ListItemSecondaryAction>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleAddCharacter(char.id)}
                    disabled={loading}
                  >
                    追加
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
```

### 2. ConversationViewer への統合

`/components/studio/conversation/ConversationViewer.tsx`

各メッセージカードに `MessageCharacterSelector` を追加：

```tsx
{/* Scene prompt section */}
{(message.scene_prompt_ja || message.scene_prompt_en) && (
  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
    <Typography variant="caption" color="text.secondary">
      シーンプロンプト
    </Typography>
    <Typography variant="body2" sx={{ mt: 0.5 }}>
      {message.scene_prompt_ja || message.scene_prompt_en}
    </Typography>

    {/* Scene characters */}
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary">
        登場キャラクター
      </Typography>
      <MessageCharacterSelector
        messageId={message.id}
        availableCharacters={availableCharacters}
        onUpdate={onUpdate}
      />
    </Box>
  </Box>
)}
```

## ワークフロー統合

### Nanobanaノードでの活用

`/lib/workflow/executor.ts` の Nanobana ケースを修正し、メッセージに紐づくキャラクターシートを自動取得：

```typescript
case 'nanobana': {
  // ... existing code ...

  // Get characters from conversation message if available
  if (node.data.config.conversationMessageId) {
    const messageCharacters = await getMessageCharacters(
      node.data.config.conversationMessageId
    );

    // Add up to 4 character sheets
    for (let i = 0; i < Math.min(messageCharacters.length, 4); i++) {
      const char = messageCharacters[i];
      if (char.character_sheets?.image_url) {
        const imageData = await fetchImageAsBase64(char.character_sheets.image_url);
        characterImages.push(imageData);
      }
    }
  }

  // ... existing code for manual selection ...
}
```

## テスト計画

### 1. データベーステスト
- [ ] マイグレーション実行
- [ ] UNIQUE制約の動作確認（重複登録の防止）
- [ ] CASCADE削除の動作確認
- [ ] RLSポリシーの動作確認

### 2. API テスト
- [ ] GET: メッセージキャラクター一覧取得
- [ ] POST: キャラクター追加
- [ ] DELETE: キャラクター削除
- [ ] PATCH: 表示順序の更新
- [ ] 所有権チェック（他人のメッセージにアクセスできない）

### 3. AI自動判定テスト
- [ ] 会話生成時に `sceneCharacterIds` が正しく返される
- [ ] 各メッセージに対して正しいキャラクターが登録される
- [ ] 複数キャラクター登場シーンの判定精度

### 4. UIテスト
- [ ] MessageCharacterSelector でキャラクター追加・削除
- [ ] ConversationViewer での表示確認
- [ ] 画像生成との連携確認

## 実装フェーズ

### Phase 1: データベース・バックエンド (優先度: 高)
1. マイグレーションファイル作成
2. `/lib/db.ts` にヘルパー関数追加
3. 型定義追加 (`/types/conversation.ts`)
4. APIエンドポイント実装 (`/api/conversations/messages/[id]/characters/route.ts`)

### Phase 2: AI自動判定 (優先度: 高)
1. プロンプト修正（`sceneCharacterIds` の追加）
2. 会話生成APIの修正（自動登録ロジック）
3. テスト・デバッグ

### Phase 3: UI実装 (優先度: 中)
1. `MessageCharacterSelector` コンポーネント作成
2. `ConversationViewer` への統合
3. 手動編集機能のテスト

### Phase 4: ワークフロー統合 (優先度: 中)
1. Nanobanaノードでの自動取得実装
2. 画像生成との連携テスト

## 成功基準

- ✅ 会話生成時にGemini AIが各メッセージの登場キャラクターを正しく判定
- ✅ `conversation_message_characters` テーブルに自動的にキャラクターが登録される
- ✅ UIで手動でキャラクターを追加・削除できる
- ✅ Nanobanaノード実行時、メッセージに紐づくキャラクターシートが自動的に使用される
- ✅ 最大4枚までのキャラクターシートが画像生成に使用される

## 注意事項

- **後方互換性**: 既存の `conversation_messages` テーブルには影響なし
- **段階的な実装**: まずAI自動判定を実装し、その後UI機能を追加
- **パフォーマンス**: メッセージ数が多い場合の一括処理に注意
- **データの整合性**: `character_id`（話者）と `scene_characters`（登場人物）は別物として管理
