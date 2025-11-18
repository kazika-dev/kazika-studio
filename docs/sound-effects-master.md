# 効果音マスターテーブル (`m_sound_effects`)

## 概要

効果音マスターテーブル (`kazikastudio.m_sound_effects`) は、GCP Storageに保存された効果音ファイルを管理するためのマスターデータテーブルです。

音声ファイルはGCP Storageの `audio/sound-effects/` フォルダに保存され、テーブルにはファイル名とメタデータが記録されます。

## テーブルスキーマ

```sql
CREATE TABLE kazikastudio.m_sound_effects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,                    -- 効果音名（表示用）
  description TEXT DEFAULT '',           -- 効果音の説明
  file_name TEXT NOT NULL UNIQUE,        -- GCP Storageのファイル名
  duration_seconds NUMERIC(10, 2),       -- 音声ファイルの長さ（秒）
  file_size_bytes BIGINT,                -- ファイルサイズ（バイト）
  category TEXT DEFAULT '',              -- カテゴリ（例: 環境音, 効果音, BGM）
  tags TEXT[] DEFAULT '{}',              -- タグ配列（検索用）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## フィールド詳細

| カラム名 | 型 | 説明 | 例 |
|---------|-----|------|---|
| `id` | BIGSERIAL | 効果音ID（自動採番） | `1` |
| `name` | TEXT | 効果音名（表示用） | `"ドアノック"` |
| `description` | TEXT | 効果音の説明 | `"ドアをノックする音"` |
| `file_name` | TEXT | GCP Storageのファイル名（UNIQUE） | `"audio/sound-effects/door-knock.mp3"` |
| `duration_seconds` | NUMERIC(10, 2) | 音声ファイルの長さ（秒） | `2.5` |
| `file_size_bytes` | BIGINT | ファイルサイズ（バイト） | `45678` |
| `category` | TEXT | カテゴリ | `"環境音"`, `"効果音"`, `"BGM"` |
| `tags` | TEXT[] | タグ配列（検索用） | `["ドア", "ノック", "室内"]` |
| `created_at` | TIMESTAMPTZ | 作成日時 | `2025-11-18 12:00:00+00` |
| `updated_at` | TIMESTAMPTZ | 更新日時（自動更新） | `2025-11-18 12:00:00+00` |

## インデックス

```sql
-- 名前検索
CREATE INDEX idx_m_sound_effects_name ON kazikastudio.m_sound_effects(name);

-- ファイル名検索（UNIQUE）
CREATE INDEX idx_m_sound_effects_file_name ON kazikastudio.m_sound_effects(file_name);

-- カテゴリ検索
CREATE INDEX idx_m_sound_effects_category ON kazikastudio.m_sound_effects(category);

-- タグ検索（GINインデックス）
CREATE INDEX idx_m_sound_effects_tags ON kazikastudio.m_sound_effects USING GIN(tags);

-- 作成日時降順
CREATE INDEX idx_m_sound_effects_created_at ON kazikastudio.m_sound_effects(created_at DESC);
```

## Row Level Security (RLS)

### ポリシー

- **全ユーザーが読み取り可能** - マスターデータのため、すべてのユーザーが効果音一覧を参照できます
- **認証済みユーザーが編集可能** - 追加・更新・削除には認証が必要です

```sql
-- 全ユーザーが参照可能
CREATE POLICY "Anyone can view sound effects"
  ON kazikastudio.m_sound_effects
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert sound effects"
  ON kazikastudio.m_sound_effects
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sound effects"
  ON kazikastudio.m_sound_effects
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sound effects"
  ON kazikastudio.m_sound_effects
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
```

## GCP Storageとの連携

### フォルダ構造

```
GCP Storage Bucket (kazikastudio-storage)
└── audio/
    └── sound-effects/
        ├── door-knock.mp3
        ├── footsteps-wood.mp3
        ├── birds-chirping.mp3
        ├── explosion.mp3
        ├── rain.mp3
        └── wind.mp3
```

### ファイル名規則

- **フォルダ**: `audio/sound-effects/`
- **ファイル名**: 英数字、ハイフン、アンダースコアのみ推奨
- **拡張子**: `.mp3`, `.wav`, `.ogg` など

例:
```
audio/sound-effects/door-knock.mp3
audio/sound-effects/footsteps-wood.mp3
audio/sound-effects/birds-chirping.mp3
```

### ファイルのアップロード・取得

GCP Storageからのファイル操作には `/lib/storage.ts` の関数を使用します:

```typescript
import { uploadFileToGCS, downloadFileFromGCS } from '@/lib/storage';

// ファイルのアップロード
const storagePath = await uploadFileToGCS(
  Buffer.from(audioData),
  'audio/sound-effects/door-knock.mp3',
  'audio/mpeg'
);

// ファイルのダウンロード
const audioBuffer = await downloadFileFromGCS('audio/sound-effects/door-knock.mp3');
```

## データベース関数 (`/lib/db.ts`)

### 全取得・検索

```typescript
import {
  getAllSoundEffects,
  getSoundEffectById,
  getSoundEffectByFileName,
  getSoundEffectsByCategory,
  getSoundEffectsByTag,
} from '@/lib/db';

// 全ての効果音を取得（カテゴリ→名前でソート）
const allSounds = await getAllSoundEffects();

// IDで取得
const sound = await getSoundEffectById(1);

// ファイル名で取得
const sound = await getSoundEffectByFileName('audio/sound-effects/door-knock.mp3');

// カテゴリで検索
const environmentSounds = await getSoundEffectsByCategory('環境音');

// タグで検索
const doorSounds = await getSoundEffectsByTag('ドア');
```

### 作成・更新・削除

```typescript
import {
  createSoundEffect,
  updateSoundEffect,
  deleteSoundEffect,
} from '@/lib/db';

// 効果音を作成
const newSound = await createSoundEffect({
  name: 'ドアノック',
  description: 'ドアをノックする音',
  file_name: 'audio/sound-effects/door-knock.mp3',
  duration_seconds: 2.5,
  file_size_bytes: 45678,
  category: '環境音',
  tags: ['ドア', 'ノック', '室内'],
});

// 効果音を更新
const updated = await updateSoundEffect(1, {
  description: '木製のドアをノックする音',
  tags: ['ドア', 'ノック', '室内', '木製'],
});

// 効果音を削除
const deleted = await deleteSoundEffect(1);
```

### ランダム取得

```typescript
import {
  getRandomSoundEffect,
  getRandomSoundEffectByCategory,
} from '@/lib/db';

// ランダムに効果音を1つ取得
const randomSound = await getRandomSoundEffect();

// カテゴリからランダムに取得
const randomEnvironmentSound = await getRandomSoundEffectByCategory('環境音');
```

## 初期データ

マイグレーション時に以下のサンプルデータが挿入されます:

| ID | 名前 | ファイル名 | カテゴリ | タグ |
|----|-----|-----------|---------|-----|
| 1 | ドアノック | `audio/sound-effects/door-knock.mp3` | 環境音 | `["ドア", "ノック", "室内"]` |
| 2 | 足音（木の床） | `audio/sound-effects/footsteps-wood.mp3` | 環境音 | `["足音", "歩く", "木の床"]` |
| 3 | 鳥のさえずり | `audio/sound-effects/birds-chirping.mp3` | 環境音 | `["鳥", "自然", "朝"]` |
| 4 | 爆発音 | `audio/sound-effects/explosion.mp3` | 効果音 | `["爆発", "アクション"]` |
| 5 | 雨音 | `audio/sound-effects/rain.mp3` | 環境音 | `["雨", "天気", "自然"]` |
| 6 | 風の音 | `audio/sound-effects/wind.mp3` | 環境音 | `["風", "天気", "自然"]` |

## API実装例

### GET `/api/sound-effects` - 効果音一覧取得

```typescript
// app/api/sound-effects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllSoundEffects, getSoundEffectsByCategory } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const soundEffects = category
      ? await getSoundEffectsByCategory(category)
      : await getAllSoundEffects();

    return NextResponse.json({ soundEffects });
  } catch (error) {
    console.error('Error fetching sound effects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sound effects' },
      { status: 500 }
    );
  }
}
```

### POST `/api/sound-effects` - 効果音作成（ファイルアップロード）

```typescript
// app/api/sound-effects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSoundEffect } from '@/lib/db';
import { uploadFileToGCS } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const tags = JSON.parse(formData.get('tags') as string);
    const audioFile = formData.get('audio') as File;

    // ファイルをGCP Storageにアップロード
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const fileName = `audio/sound-effects/${Date.now()}-${audioFile.name}`;
    await uploadFileToGCS(buffer, fileName, audioFile.type);

    // データベースに登録
    const soundEffect = await createSoundEffect({
      name,
      description,
      file_name: fileName,
      duration_seconds: null, // TODO: 音声ファイルから取得
      file_size_bytes: buffer.length,
      category,
      tags,
    });

    return NextResponse.json({ soundEffect });
  } catch (error) {
    console.error('Error creating sound effect:', error);
    return NextResponse.json(
      { error: 'Failed to create sound effect' },
      { status: 500 }
    );
  }
}
```

### GET `/api/sound-effects/[id]/download` - 音声ファイルダウンロード

```typescript
// app/api/sound-effects/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSoundEffectById } from '@/lib/db';
import { downloadFileFromGCS } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const soundEffect = await getSoundEffectById(parseInt(params.id));

    if (!soundEffect) {
      return NextResponse.json(
        { error: 'Sound effect not found' },
        { status: 404 }
      );
    }

    // GCP Storageからファイルをダウンロード
    const audioBuffer = await downloadFileFromGCS(soundEffect.file_name);

    // 音声ファイルを返す
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${soundEffect.name}.mp3"`,
      },
    });
  } catch (error) {
    console.error('Error downloading sound effect:', error);
    return NextResponse.json(
      { error: 'Failed to download sound effect' },
      { status: 500 }
    );
  }
}
```

## フロントエンド実装例

### 効果音一覧表示

```typescript
// components/SoundEffectsList.tsx
'use client';

import { useState, useEffect } from 'react';

interface SoundEffect {
  id: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  duration_seconds: number;
}

export function SoundEffectsList() {
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    async function fetchSoundEffects() {
      const url = category
        ? `/api/sound-effects?category=${encodeURIComponent(category)}`
        : '/api/sound-effects';
      const res = await fetch(url);
      const data = await res.json();
      setSoundEffects(data.soundEffects);
    }

    fetchSoundEffects();
  }, [category]);

  const playSound = async (id: number) => {
    const audio = new Audio(`/api/sound-effects/${id}/download`);
    await audio.play();
  };

  return (
    <div>
      <h1>効果音ライブラリ</h1>

      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">全カテゴリ</option>
        <option value="環境音">環境音</option>
        <option value="効果音">効果音</option>
        <option value="BGM">BGM</option>
      </select>

      <ul>
        {soundEffects.map((sound) => (
          <li key={sound.id}>
            <h3>{sound.name}</h3>
            <p>{sound.description}</p>
            <p>カテゴリ: {sound.category}</p>
            <p>タグ: {sound.tags.join(', ')}</p>
            <button onClick={() => playSound(sound.id)}>再生</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## マイグレーション

### マイグレーションファイル

```bash
supabase/migrations/20251118000001_create_sound_effects_master_table.sql
```

### 実行方法

```bash
# マイグレーションを実行
node scripts/run-migration.js supabase/migrations/20251118000001_create_sound_effects_master_table.sql

# 検証
node scripts/verify-migration.js
```

## 将来の拡張案

### 音声ファイルメタデータの自動取得

```typescript
import { parseBuffer } from 'music-metadata';

// 音声ファイルのメタデータを取得
const metadata = await parseBuffer(buffer, audioFile.type);
const duration_seconds = metadata.format.duration; // 秒
const file_size_bytes = buffer.length;
```

### 波形データの保存

```typescript
// テーブルに waveform_data JSONB カラムを追加
ALTER TABLE kazikastudio.m_sound_effects ADD COLUMN waveform_data JSONB;

// 波形データを生成して保存（例: WaveSurfer.js）
const waveform = generateWaveformData(audioBuffer);
await updateSoundEffect(id, { waveform_data: waveform });
```

### 全文検索

```typescript
// PostgreSQL全文検索インデックス
CREATE INDEX idx_m_sound_effects_fulltext
ON kazikastudio.m_sound_effects
USING GIN(to_tsvector('japanese', name || ' ' || description));

// 検索クエリ
SELECT * FROM kazikastudio.m_sound_effects
WHERE to_tsvector('japanese', name || ' ' || description) @@ to_tsquery('japanese', 'ドア & ノック');
```

## 参考リンク

- [GCP Storage Setup](/docs/GCP_STORAGE_SETUP.md)
- [Database Schema](/docs/database.md)
- [DATABASE.md](/DATABASE.md)

## 変更履歴

- **2025-11-18**: 効果音マスターテーブル初版作成
