
Headers
hf-api-key
Type:Hf-Api-Key
Format:uuid
required
hf-secret
Type:Hf-Secret
required
Body
required
application/json
params
Type:Params
required
Hide Paramsfor params
input_images
Type:array Input Images[]
…8
required
Show Child Attributesfor input_images
prompt
Type:Prompt
required
aspect_ratio
Type:SeeDreamAspectRatio
enum
default: 
"4:3"
1:1
4:3
16:9
3:2
21:9
3:4
9:16
2:3
quality
Type:SeeDreamQuality
enum
default: 
"basic"
basic
high



import { request } from 'undici'

const { statusCode, body } = await request('https://platform.higgsfield.ai/v1/text2image/seedream', {
  method: 'POST',
  headers: {
    'hf-api-key': '',
    'hf-secret': '',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    params: {
      prompt: '',
      quality: 'basic',
      aspect_ratio: '4:3',
      input_images: [
        {
          type: 'image_url',
          image_url: ''
        }
      ]
    }
  })
})


Responses
200
Type:JobSet
created_at
Type:Created At
Format:date-time
read-only
required
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

id
Type:Id
Format:uuid
required
jobs
Type:array Jobs[]
required
Hide Jobfor jobs
id
Type:Id
Format:uuid
required
results
Type:Results
nullable
required
Hide Resultsfor results
min
Type:object
Optimized version of generated result

Hide Child Attributesfor min
type
Type:string
url
Type:string
raw
Type:object
Raw version without optimization

Hide Child Attributesfor raw
type
Type:string
url
Type:string
Format:uri
status
Type:JobStatus
enum
queued
in_progress
completed
failed
nsfw

{
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "title": "Id"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "title": "Created At",
      "readOnly": true
    },
    "jobs": {
      "items": {
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "status": {
            "type": "string",
            "enum": [
              "queued",
              "in_progress",
              "completed",
              "failed",
              "nsfw"
            ],
            "title": "JobStatus"
          },
          "results": {
            "anyOf": [
              {
                "properties": {
                  "min": {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string"
                      },
                      "url": {
                        "type": "string"
                      }
                    },
                    "additionalProperties": false,
                    "description": "Optimized version of generated result"
                  },
                  "raw": {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string"
                      },
                      "url": {
                        "type": "string",
                        "format": "uri"
                      }
                    },
                    "additionalProperties": false,
                    "description": "Raw version without optimization"
                  }
                },
                "additionalProperties": false,
                "type": "object"
              },
              {
                "type": "null"
              }
            ],
            "title": "Results"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "id",
          "results"
        ],
        "title": "Job"
      },
      "type": "array",
      "title": "Jobs"
    }
  },
  "additionalProperties": false,
  "type": "object",
  "required": [
    "id",
    "created_at",
    "jobs"
  ],
  "title": "JobSet"
}

Successful Response




422
Type:HTTPValidationError
detail
Type:array Detail[]
Hide ValidationErrorfor detail
loc
Type:array Location[]
required
Hide Child Attributesfor loc

Any of
string
Type:string
msg
Type:Message
required
type
Type:Error Type
required


{
  "properties": {
    "detail": {
      "items": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      },
      "type": "array",
      "title": "Detail"
    }
  },
  "type": "object",
  "title": "HTTPValidationError"
}

---

## Seedream4 ノードについて

Seedream4は、Higgsfieldプラットフォームのtext2image APIを使用して、参照画像とプロンプトから新しい画像を生成するノードです。

### 主な機能

- **参照画像ベースの画像生成**: 最大8枚の入力画像を参照して、新しい画像を生成
- **カスタマイズ可能な設定**: アスペクト比と品質を選択可能
- **プロンプト変数**: 前のノードの出力を参照可能

### 必須要件

1. **入力画像**: このノードの前に画像生成ノード（Nanobanaなど）または画像入力ノードを接続する必要があります（最大8枚）
2. **環境変数**: 以下の環境変数を `.env.local` ファイルに設定する必要があります
   - `HIGGSFIELD_API_KEY`: Higgsfield APIキー (UUID形式)
   - `HIGGSFIELD_SECRET`: Higgsfieldシークレット

### ノード設定

#### 基本設定

- **名前**: ノードの表示名
- **説明**: ノードの説明（オプション）

#### Seedream4固有の設定

- **プロンプト** (必須): 画像生成用のテキストプロンプト
  - 前のノードの出力を参照可能:
    - `{{prev.response}}` - 直前のノードの出力
    - `{{ノード名.response}}` - 特定のノードの出力

- **アスペクト比**: 生成される画像のアスペクト比
  - `1:1` - 正方形
  - `4:3` (デフォルト)
  - `16:9` - 横長
  - `3:2`
  - `21:9` - 超横長
  - `3:4` - 縦長
  - `9:16` - 縦長
  - `2:3`

- **品質**: 生成画像の品質
  - `basic` (デフォルト) - 基本品質
  - `high` - 高品質

### 使用例

1. **画像生成ノードを追加**
   - Nanobanaノードなどで参照用の画像を生成するか、画像入力ノードで画像をアップロード

2. **Seedream4ノードを追加**
   - ワークフローに新しいSeedream4ノードを追加
   - 画像生成ノードとSeedream4ノードを接続

3. **設定を構成**
   - プロンプトを入力（例: "A futuristic city with neon lights"）
   - アスペクト比を選択（例: 16:9）
   - 品質を選択（例: high）

4. **実行**
   - ノードの実行ボタンをクリック
   - 生成された画像がノード内にプレビュー表示されます

### ノードの状態

- **idle**: 待機中
- **loading**: 画像生成中（スピナーアイコン表示）
- **success**: 生成成功（チェックアイコン表示、画像プレビュー表示）
- **error**: 生成失敗（エラーアイコン表示、エラーメッセージ表示）

### トラブルシューティング

- **"プロンプトを設定してください"エラー**: プロンプトフィールドが空です。プロンプトを入力してください
- **"Failed to generate image"エラー**:
  - 環境変数が正しく設定されているか確認
  - 入力画像が正しく接続されているか確認
  - APIキーとシークレットが有効か確認
- **422エラー**: リクエストパラメータが不正です。設定を確認してください

### API実装

ノードは `/api/seedream4` エンドポイントを使用します。実装は以下のファイルにあります:

- **ノードコンポーネント**: `components/workflow/Seedream4Node.tsx`
- **設定パネル**: `components/workflow/Seedream4NodeSettings.tsx`
- **APIエンドポイント**: `app/api/seedream4/route.ts`