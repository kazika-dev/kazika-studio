/**
 * ワークフローアウトプットの型定義
 */

export type OutputType = 'image' | 'video' | 'audio' | 'text' | 'file' | 'json';

export interface WorkflowOutput {
  id: number;
  user_id: string;
  workflow_id: number | null;
  output_type: OutputType;
  content_url: string | null;
  content_text: string | null;
  prompt: string | null;
  metadata: Record<string, any>;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOutputRequest {
  workflowId?: number;
  outputType: OutputType;
  content: string | FileContent;
  prompt?: string;
  metadata?: Record<string, any>;
}

export interface FileContent {
  path?: string; // GCP Storage内部パス（推奨）
  url?: string; // 既にアップロード済みのURL（後方互換性）
  base64?: string; // Base64エンコードされたデータ
  mimeType?: string; // MIMEタイプ（base64の場合必須）
  fileName?: string; // ファイル名（オプション）
}

export interface OutputListResponse {
  success: boolean;
  outputs: WorkflowOutput[];
}

export interface OutputCreateResponse {
  success: boolean;
  output: WorkflowOutput;
}

export interface OutputDeleteResponse {
  success: boolean;
  message: string;
}
