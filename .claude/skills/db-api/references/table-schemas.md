# テーブルスキーマ詳細

## workflows

```sql
id            SERIAL PRIMARY KEY
user_id       UUID NOT NULL (auth.users)
name          TEXT NOT NULL
description   TEXT
nodes         JSONB          -- ReactFlowノード定義
edges         JSONB          -- ReactFlowエッジ定義
form_config   JSONB          -- /form ページ用設定
metadata      JSONB
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

## studios

```sql
id            SERIAL PRIMARY KEY
user_id       UUID NOT NULL
name          TEXT NOT NULL
description   TEXT
thumbnail_url TEXT
metadata      JSONB
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

## studio_boards

```sql
id             SERIAL PRIMARY KEY
studio_id      INTEGER NOT NULL (studios.id, CASCADE)
workflow_id    INTEGER (workflows.id)
name           TEXT
sequence_order INTEGER NOT NULL
status         TEXT DEFAULT 'pending'
output_ids     INTEGER[]      -- workflow_outputs.id の配列
metadata       JSONB
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

## studio_board_workflow_steps

```sql
id             SERIAL PRIMARY KEY
board_id       INTEGER NOT NULL (studio_boards.id, CASCADE)
workflow_id    INTEGER NOT NULL (workflows.id)
sequence_order INTEGER NOT NULL
status         TEXT DEFAULT 'pending'
input_config   JSONB          -- workflowInputs, nodeOverrides
output_data    JSONB          -- { [nodeId]: { type, data, ... } }
metadata       JSONB          -- execution_requests など
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

## conversations

```sql
id             SERIAL PRIMARY KEY
user_id        UUID NOT NULL
studio_id      INTEGER (studios.id, CASCADE) -- NULL可
story_scene_id INTEGER (story_scenes.id, CASCADE) -- NULL可
title          TEXT
metadata       JSONB
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
-- studio_id OR story_scene_id のどちらかが必須
```

## conversation_messages

```sql
id               SERIAL PRIMARY KEY
conversation_id  INTEGER NOT NULL (conversations.id, CASCADE)
character_id     INTEGER (character_sheets.id) -- 話者
speaker_name     TEXT
message_text     TEXT NOT NULL    -- [emotionTag] プレフィックス付き
emotion          TEXT
scene            TEXT
scene_prompt_ja  TEXT             -- 日本語シーンプロンプト
scene_prompt_en  TEXT             -- 英語シーンプロンプト
sequence_order   INTEGER NOT NULL
metadata         JSONB            -- emotionTag, cameraAngle 等
created_at       TIMESTAMPTZ
```

## conversation_message_characters

```sql
id             SERIAL PRIMARY KEY
message_id     INTEGER NOT NULL (conversation_messages.id, CASCADE)
character_id   INTEGER NOT NULL (character_sheets.id, CASCADE)
display_order  INTEGER DEFAULT 0
created_at     TIMESTAMPTZ
UNIQUE(message_id, character_id)
```

## stories

```sql
id          SERIAL PRIMARY KEY
user_id     UUID NOT NULL
title       TEXT NOT NULL
description TEXT
metadata    JSONB
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

## story_scenes

```sql
id             SERIAL PRIMARY KEY
story_id       INTEGER NOT NULL (stories.id, CASCADE)
title          TEXT NOT NULL
description    TEXT
sequence_order INTEGER NOT NULL
metadata       JSONB
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

## workflow_outputs

```sql
id           SERIAL PRIMARY KEY
user_id      UUID NOT NULL
workflow_id  INTEGER (workflows.id)
output_type  TEXT NOT NULL  -- 'image', 'video', 'audio', 'text'
content_url  TEXT           -- GCP Storage パス
content_text TEXT           -- テキスト出力用
prompt       TEXT
source_url   TEXT
favorite     BOOLEAN DEFAULT false
metadata     JSONB          -- step_id, node_id, width, height 等
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

## character_sheets

```sql
id              SERIAL PRIMARY KEY
user_id         UUID NOT NULL
name            TEXT NOT NULL
description     TEXT
storage_path    TEXT NOT NULL   -- GCP Storage パス
width           INTEGER
height          INTEGER
file_size_bytes INTEGER
is_favorite     BOOLEAN DEFAULT false
voice_id        TEXT            -- ElevenLabs voice ID
metadata        JSONB
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## prompt_queues

```sql
id               SERIAL PRIMARY KEY
user_id          UUID NOT NULL
prompt           TEXT NOT NULL
enhance_prompt   TEXT DEFAULT 'none'  -- 'none' or 'enhance'
enhanced_prompt  TEXT
model            TEXT DEFAULT 'gemini-2.5-flash-image'
aspect_ratio     TEXT DEFAULT '1:1'
status           TEXT DEFAULT 'pending'
                 -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
error_message    TEXT
metadata         JSONB
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

## prompt_queue_images

```sql
id            SERIAL PRIMARY KEY
queue_id      INTEGER NOT NULL (prompt_queues.id, CASCADE)
image_type    TEXT NOT NULL
              -- 'character_sheet', 'output', 'scene', 'prop'
reference_id  INTEGER NOT NULL  -- 参照先テーブルのID
display_order INTEGER DEFAULT 0
created_at    TIMESTAMPTZ
```

## m_text_templates

```sql
id          SERIAL PRIMARY KEY
user_id     UUID             -- NULL = 共有テンプレート
name        TEXT NOT NULL
content     TEXT NOT NULL
category    TEXT             -- 'general', 'prompt', 'scene', 'character'
tags        TEXT[]
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

## m_image_materials

```sql
id              SERIAL PRIMARY KEY
user_id         UUID
name            TEXT NOT NULL
description     TEXT
storage_path    TEXT NOT NULL
width           INTEGER
height          INTEGER
file_size_bytes INTEGER
category        TEXT   -- 'background', 'character', 'texture', 'parts', 'other'
tags            TEXT[]
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## api_keys

```sql
id           SERIAL PRIMARY KEY
user_id      UUID NOT NULL
name         TEXT
key_hash     TEXT NOT NULL   -- SHA-256 ハッシュ
last_used_at TIMESTAMPTZ
expires_at   TIMESTAMPTZ
is_active    BOOLEAN DEFAULT true
created_at   TIMESTAMPTZ
```
