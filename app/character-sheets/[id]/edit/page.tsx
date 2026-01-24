'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  CircularProgress,
  Container,
  Paper,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Upload as UploadIcon, Brush as BrushIcon } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

// ImageEditorは重いコンポーネントなのでdynamic importでSSRを無効化
const ImageEditor = dynamic(() => import('@/components/common/ImageEditor'), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  ),
});

interface CharacterSheet {
  id: number;
  user_id: string;
  name: string;
  image_url: string;
  description: string;
  elevenlabs_voice_id?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export default function EditCharacterSheetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [characterSheet, setCharacterSheet] = useState<CharacterSheet | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadCharacterSheet();
  }, [id]);

  const loadCharacterSheet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/character-sheets/${id}`);
      const data = await response.json();

      if (data.success) {
        setCharacterSheet(data.characterSheet);
        setName(data.characterSheet.name);
        setDescription(data.characterSheet.description || '');
        setElevenLabsVoiceId(data.characterSheet.elevenlabs_voice_id || '');
        setImagePreview(data.characterSheet.image_url);
      } else {
        toast.error('キャラクターシートの取得に失敗しました');
        router.push('/character-sheets');
      }
    } catch (error) {
      console.error('Failed to load character sheet:', error);
      toast.error('キャラクターシートの取得に失敗しました');
      router.push('/character-sheets');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    console.log('[edit] Uploading image to charactersheets folder:', file.name);

    // FileをBase64に変換
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // data:image/png;base64,... から base64部分のみを抽出
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data,
        mimeType: file.type,
        fileName: file.name,
        folder: 'charactersheets', // キャラクターシート専用フォルダ
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '画像のアップロードに失敗しました');
    }

    console.log('[edit] Image uploaded successfully:', data.storagePath);
    return data.storagePath;
  };

  // Strip /api/storage/ prefix from URL to get the actual storage path
  const stripApiStoragePrefix = (url: string | undefined): string | undefined => {
    if (!url) return url;
    // Handle both /api/storage/ and api/storage/ (without leading slash)
    if (url.startsWith('/api/storage/')) {
      return url.replace('/api/storage/', '');
    }
    if (url.startsWith('api/storage/')) {
      return url.replace('api/storage/', '');
    }
    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('キャラクター名を入力してください');
      return;
    }

    try {
      setSaving(true);

      // Strip the API prefix to get the actual storage path
      let imageUrl = stripApiStoragePrefix(characterSheet?.image_url);

      // 画像が変更された場合はアップロード
      if (imageFile) {
        console.log('[edit] New image detected, uploading...', imageFile.name);
        setUploading(true);
        imageUrl = await uploadImage(imageFile);
        setUploading(false);
      } else {
        console.log('[edit] No new image, using existing URL:', imageUrl);
      }

      // キャラクターシートを更新
      const response = await fetch(`/api/character-sheets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          image_url: imageUrl,
          description: description.trim(),
          elevenlabs_voice_id: elevenLabsVoiceId.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('キャラクターシートを更新しました');
        router.push('/character-sheets');
      } else {
        toast.error(data.error || 'キャラクターシートの更新に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to update character sheet:', error);
      toast.error(error.message || 'キャラクターシートの更新に失敗しました');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Toaster position="top-center" />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.back()}
        sx={{ mb: 2 }}
      >
        戻る
      </Button>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            キャラクターシート編集
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            キャラクターシート情報を編集します
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="キャラクター名"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />

            <TextField
              label="説明（任意）"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />

            <TextField
              label="ElevenLabs音声ID（任意）"
              fullWidth
              value={elevenLabsVoiceId}
              onChange={(e) => setElevenLabsVoiceId(e.target.value)}
              disabled={saving}
              placeholder="例: 21m00Tcm4TlvDq8ikWAM"
              helperText="ElevenLabsの音声IDを入力すると、音声生成時に使用されます"
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                画像
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  border: '2px dashed',
                  borderColor: 'divider',
                  textAlign: 'center',
                }}
              >
                {imagePreview ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ maxWidth: '400px', mx: 'auto' }}>
                      <img
                        src={imagePreview.startsWith('data:') || imagePreview.startsWith('http') || imagePreview.startsWith('/api/') ? imagePreview : `/api/storage/${imagePreview}`}
                        alt="プレビュー"
                        style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Button
                        variant="outlined"
                        component="label"
                        disabled={saving}
                      >
                        画像を変更
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<BrushIcon />}
                        onClick={() => {
                          // 画像エディタを開く
                          const imgUrl = imagePreview.startsWith('data:') || imagePreview.startsWith('http') || imagePreview.startsWith('/api/')
                            ? imagePreview
                            : `/api/storage/${imagePreview}`;
                          setEditingImageUrl(imgUrl);
                          setImageEditorOpen(true);
                        }}
                        disabled={saving}
                      >
                        画像を編集
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Button
                      variant="outlined"
                      component="label"
                      disabled={saving}
                    >
                      画像を選択
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </Button>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                      PNG, JPG, GIF (最大10MB)
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => router.back()}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={saving}
              >
                {uploading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    画像をアップロード中...
                  </>
                ) : saving ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    更新中...
                  </>
                ) : (
                  '更新'
                )}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 画像エディタ（フルスクリーンダイアログ） */}
      {imageEditorOpen && editingImageUrl && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1300,
            bgcolor: 'background.paper',
          }}
        >
          <ImageEditor
            imageUrl={editingImageUrl}
            onSave={async (blob, saveMode?: 'overwrite' | 'new') => {
              try {
                const formData = new FormData();
                formData.append('file', blob, 'edited-image.png');

                if (saveMode === 'new') {
                  // 新規保存: 新しいキャラクターシートとして保存
                  formData.append('name', `${name} (編集済み)`);
                  formData.append('description', description);
                  if (elevenLabsVoiceId) {
                    formData.append('elevenlabs_voice_id', elevenLabsVoiceId);
                  }

                  // Base64に変換してAPIに送信
                  const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const result = reader.result as string;
                      const base64 = result.split(',')[1];
                      resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });

                  // まず画像をアップロード
                  const uploadResponse = await fetch('/api/upload-image', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      base64Data,
                      mimeType: 'image/png',
                      fileName: 'edited-image.png',
                      folder: 'charactersheets',
                    }),
                  });

                  const uploadData = await uploadResponse.json();
                  if (!uploadData.success) {
                    throw new Error(uploadData.error || 'Failed to upload image');
                  }

                  // 新しいキャラクターシートを作成
                  const createResponse = await fetch('/api/character-sheets', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      name: `${name} (編集済み)`,
                      image_url: uploadData.storagePath,
                      description: description,
                      elevenlabs_voice_id: elevenLabsVoiceId || undefined,
                    }),
                  });

                  const createData = await createResponse.json();
                  if (!createData.success) {
                    throw new Error(createData.error || 'Failed to create character sheet');
                  }

                  toast.success('新しいキャラクターシートとして保存しました');
                } else {
                  // 上書き保存: 既存の画像を差し替え
                  const response = await fetch(`/api/character-sheets/${id}/replace-image`, {
                    method: 'PUT',
                    body: formData,
                  });

                  const data = await response.json();

                  if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to save image');
                  }

                  toast.success('画像を更新しました');
                }

                setImageEditorOpen(false);
                setEditingImageUrl(null);
                // ページをリロードして変更を反映
                loadCharacterSheet();
              } catch (err) {
                console.error('Error saving image:', err);
                toast.error('画像の保存に失敗しました: ' + (err instanceof Error ? err.message : ''));
              }
            }}
            onClose={() => {
              setImageEditorOpen(false);
              setEditingImageUrl(null);
            }}
            enableSaveModeSelection={true}
          />
        </Box>
      )}
    </Container>
  );
}
