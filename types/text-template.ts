/**
 * テキストテンプレートのメディア（参考画像・動画）
 */
export interface TextTemplateMedia {
  id: number;
  template_id: number;
  media_type: 'image' | 'video';
  file_name: string;
  original_name: string | null;
  mime_type: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  display_order: number;
  caption: string | null;
  signed_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * メディア作成リクエスト
 */
export interface CreateTextTemplateMediaRequest {
  template_id: number;
  media_type: 'image' | 'video';
  file_name: string;
  original_name?: string;
  mime_type: string;
  file_size_bytes?: number;
  width?: number;
  height?: number;
  duration_seconds?: number;
  display_order?: number;
  caption?: string;
}

/**
 * テキストテンプレート（既存の型をエクスポート）
 */
export interface TextTemplate {
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
  media_count?: number;
}
