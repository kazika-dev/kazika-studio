# API エンドポイント一覧

## Workflows (`/api/workflows/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/workflows` | 一覧取得 |
| POST | `/api/workflows` | 新規作成 |
| GET | `/api/workflows/[id]` | 個別取得 |
| PUT | `/api/workflows/[id]` | 更新 |
| DELETE | `/api/workflows/[id]` | 削除 |
| POST | `/api/workflows/execute` | 保存済みWF実行 |
| POST | `/api/workflows/execute-draft` | ドラフト実行 |

## Studios (`/api/studios/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/studios` | 一覧取得 |
| POST | `/api/studios` | 新規作成 |
| GET | `/api/studios/[id]` | 個別取得 |
| PUT | `/api/studios/[id]` | 更新 |
| DELETE | `/api/studios/[id]` | 削除 |
| GET | `/api/studios/[id]/boards` | ボード一覧 |
| POST | `/api/studios/[id]/boards` | ボード作成 |
| POST | `/api/studios/[id]/boards/reorder` | ボード並替 |

## Studio Steps (`/api/studios/steps/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/studios/steps/[id]` | ステップ取得 |
| PUT | `/api/studios/steps/[id]` | ステップ更新 |
| DELETE | `/api/studios/steps/[id]` | ステップ削除 |
| POST | `/api/studios/steps/[id]/execute` | 全ノード実行 |
| POST | `/api/studios/steps/[id]/execute-node` | 単一ノード実行 |
| PATCH | `/api/studios/steps/[id]/update-node-inputs` | ノード入力更新 |

## Conversations (`/api/conversations/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/conversations` | 一覧取得 |
| POST | `/api/conversations` | 新規作成 |
| GET | `/api/conversations/[id]` | 個別取得 |
| DELETE | `/api/conversations/[id]` | 削除 |
| POST | `/api/conversations/generate` | AI生成 |
| POST | `/api/conversations/[id]/create-studio` | スタジオ作成 |

## Messages (`/api/conversations/messages/`)

| メソッド | パス | 用途 |
|----------|------|------|
| POST | `/api/conversations/messages` | メッセージ作成 |
| GET | `/api/conversations/messages/[id]` | メッセージ取得 |
| PUT | `/api/conversations/messages/[id]` | メッセージ更新 |
| DELETE | `/api/conversations/messages/[id]` | メッセージ削除 |
| POST | `/api/conversations/messages/[id]/reanalyze-emotion` | 感情再分析 |
| GET/POST/DELETE | `/api/conversations/messages/[id]/characters` | シーンキャラ操作 |

## Stories & Scenes

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/stories` | ストーリー一覧 |
| POST | `/api/stories` | ストーリー作成 |
| GET | `/api/stories/tree` | 階層構造取得 |
| GET | `/api/stories/[id]` | ストーリー取得 |
| DELETE | `/api/stories/[id]` | ストーリー削除 |
| POST | `/api/stories/[id]/scenes` | シーン作成 |
| DELETE | `/api/scenes/[id]` | シーン削除 |

## Outputs (`/api/outputs/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/outputs` | 一覧取得 |
| GET | `/api/outputs?id=X` | 個別取得 |
| POST | `/api/outputs` | 新規作成 |
| PUT | `/api/outputs/[id]` | 更新 |
| POST | `/api/outputs/[id]/favorite` | お気に入り切替 |
| POST | `/api/outputs/[id]/replace-image` | 画像差替 |
| POST | `/api/outputs/save-edited` | 編集済み保存 |

## Character Sheets (`/api/character-sheets/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/character-sheets` | 一覧取得 |
| POST | `/api/character-sheets` | 新規作成 |
| GET | `/api/character-sheets/[id]` | 個別取得 |
| PUT | `/api/character-sheets/[id]` | 更新 |
| DELETE | `/api/character-sheets/[id]` | 削除 |

## Prompt Queue (`/api/prompt-queue/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/prompt-queue` | 一覧取得（ページング） |
| POST | `/api/prompt-queue` | 新規作成 |
| GET | `/api/prompt-queue/[id]` | 個別取得 |
| PUT | `/api/prompt-queue/[id]` | 更新 |
| DELETE | `/api/prompt-queue/[id]` | 削除 |
| POST | `/api/prompt-queue/[id]/execute` | 単一実行 |
| POST | `/api/prompt-queue/execute-all` | 全件実行 |
| POST | `/api/prompt-queue/enhance` | プロンプト補完 |
| POST | `/api/prompt-queue/bulk-enhance` | 一括補完 |
| POST | `/api/prompt-queue/bulk-update` | 一括更新 |

## Master Tables (`/api/master-tables/[table]/`)

対応テーブル: `m_text_templates`, `m_image_materials`, `m_camera_angles`, `m_shot_distances`

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/master-tables/[table]` | 一覧取得 |
| POST | `/api/master-tables/[table]` | 新規作成 |
| GET | `/api/master-tables/[table]/[id]` | 個別取得 |
| PUT | `/api/master-tables/[table]/[id]` | 更新 |
| DELETE | `/api/master-tables/[table]/[id]` | 削除 |

## AI Services

| メソッド | パス | 用途 |
|----------|------|------|
| POST | `/api/gemini` | テキスト/画像分析 |
| POST | `/api/nanobana` | 画像生成 |
| POST | `/api/elevenlabs` | 音声生成 |
| POST | `/api/higgsfield` | 動画生成 |
| POST | `/api/seedream4` | 動画生成 |

## API Keys (`/api/api-keys/`)

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/api-keys` | 一覧取得 |
| POST | `/api/api-keys` | 新規作成 |
| DELETE | `/api/api-keys/[id]` | 削除 |
| PUT | `/api/api-keys/[id]` | 有効/無効切替 |
