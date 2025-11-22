/**
 * 画像素材マスタの型定義
 */

export interface ImageMaterial {
  id: number;
  name: string;
  description: string;
  file_name: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  signed_url?: string; // フロントエンド用（GCP StorageのSigned URL）
}

export interface CreateImageMaterialRequest {
  name: string;
  description: string;
  category: string;
  tags: string[];
  image: File;
}

export interface UpdateImageMaterialRequest {
  name: string;
  description: string;
  category: string;
  tags: string[];
}

export interface CreateImageMaterialData {
  name: string;
  description: string;
  file_name: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  category: string;
  tags: string[];
}

export interface UpdateImageMaterialData {
  name: string;
  description: string;
  category: string;
  tags: string[];
}

export const IMAGE_MATERIAL_CATEGORIES = [
  '背景',
  'キャラクター',
  'テクスチャ',
  'パーツ',
  'その他',
] as const;

export type ImageMaterialCategory = typeof IMAGE_MATERIAL_CATEGORIES[number];
