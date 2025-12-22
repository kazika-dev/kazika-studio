/**
 * プロンプトキュー機能の型定義
 */

// キューのステータス
export type PromptQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// 参照画像のタイプ
export type PromptQueueImageType = 'character_sheet' | 'output';

// プロンプト補完モード
export type PromptEnhanceMode = 'none' | 'enhance';

// プロンプトキューのメイン型
export interface PromptQueue {
  id: number;
  user_id: string;
  name: string | null;
  prompt: string;
  negative_prompt: string | null;
  model: string;
  aspect_ratio: string;
  priority: number;
  status: PromptQueueStatus;
  enhance_prompt: PromptEnhanceMode;  // プロンプト補完モード
  enhanced_prompt: string | null;      // 補完後のプロンプト
  metadata: Record<string, any>;
  error_message: string | null;
  output_id: number | null;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
}

// 参照画像の型
export interface PromptQueueImage {
  id: number;
  queue_id: number;
  image_type: PromptQueueImageType;
  reference_id: number;
  display_order: number;
  created_at: string;
}

// 参照画像の詳細情報付き型（JOINで取得）
export interface PromptQueueImageWithDetails extends PromptQueueImage {
  image_url: string | null;
  name: string | null;
}

// キュー + 参照画像の型
export interface PromptQueueWithImages extends PromptQueue {
  images: PromptQueueImageWithDetails[];
  image_count: number;
}

// --- リクエスト/レスポンス型 ---

// キュー作成リクエスト
export interface CreatePromptQueueRequest {
  name?: string;
  prompt: string;
  negative_prompt?: string;
  model?: string;
  aspect_ratio?: string;
  priority?: number;
  enhance_prompt?: PromptEnhanceMode;
  enhanced_prompt?: string | null;  // 補完後のプロンプト（作成時に補完した場合）
  images?: {
    image_type: PromptQueueImageType;
    reference_id: number;
  }[];
  metadata?: Record<string, any>;
}

// キュー更新リクエスト
export interface UpdatePromptQueueRequest {
  name?: string;
  prompt?: string;
  negative_prompt?: string;
  model?: string;
  aspect_ratio?: string;
  priority?: number;
  status?: PromptQueueStatus;
  enhance_prompt?: PromptEnhanceMode;
  enhanced_prompt?: string | null;
  images?: {
    image_type: PromptQueueImageType;
    reference_id: number;
  }[];
  metadata?: Record<string, any>;
}

// キュー一覧取得レスポンス
export interface ListPromptQueuesResponse {
  success: boolean;
  queues: PromptQueueWithImages[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// キュー詳細取得レスポンス
export interface GetPromptQueueResponse {
  success: boolean;
  queue: PromptQueueWithImages;
}

// キュー作成/更新レスポンス
export interface PromptQueueMutationResponse {
  success: boolean;
  queue: PromptQueueWithImages;
}

// キュー削除レスポンス
export interface DeletePromptQueueResponse {
  success: boolean;
  message: string;
}

// キュー実行レスポンス
export interface ExecutePromptQueueResponse {
  success: boolean;
  queue: PromptQueueWithImages;
  output?: {
    id: number;
    content_url: string;
  };
}

// 一括実行レスポンス
export interface ExecuteAllPromptQueuesResponse {
  success: boolean;
  executed: number;
  failed: number;
  results: {
    queue_id: number;
    success: boolean;
    error?: string;
  }[];
}
