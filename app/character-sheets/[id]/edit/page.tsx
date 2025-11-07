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
import { ArrowBack as ArrowBackIcon, Upload as UploadIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

interface CharacterSheet {
  id: number;
  user_id: string;
  name: string;
  image_url: string;
  description: string;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('キャラクター名を入力してください');
      return;
    }

    try {
      setSaving(true);

      let imageUrl = characterSheet?.image_url;

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
                        src={imagePreview.startsWith('data:') || imagePreview.startsWith('http') ? imagePreview : `/api/storage/${imagePreview}`}
                        alt="プレビュー"
                        style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                      />
                    </Box>
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
    </Container>
  );
}
