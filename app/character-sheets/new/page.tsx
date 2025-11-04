'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import Image from 'next/image';

export default function NewCharacterSheetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '画像のアップロードに失敗しました');
    }

    return data.storagePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('キャラクター名を入力してください');
      return;
    }

    if (!imageFile) {
      toast.error('画像を選択してください');
      return;
    }

    try {
      setLoading(true);
      setUploading(true);

      // 画像をアップロード
      const imageUrl = await uploadImage(imageFile);
      setUploading(false);

      // キャラクターシートを作成
      const response = await fetch('/api/character-sheets', {
        method: 'POST',
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
        toast.success('キャラクターシートを作成しました');
        router.push('/character-sheets');
      } else {
        toast.error(data.error || 'キャラクターシートの作成に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to create character sheet:', error);
      toast.error(error.message || 'キャラクターシートの作成に失敗しました');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

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
            キャラクターシート新規作成
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            キャラクターシート画像を登録します
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="キャラクター名"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />

            <TextField
              label="説明（任意）"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                画像 *
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
                    <Box sx={{ position: 'relative', aspectRatio: '3/4', maxWidth: '400px', mx: 'auto' }}>
                      <Image
                        src={imagePreview}
                        alt="プレビュー"
                        fill
                        style={{ objectFit: 'contain' }}
                      />
                    </Box>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      disabled={loading}
                    >
                      画像を変更
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Button
                      variant="outlined"
                      component="label"
                      disabled={loading}
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
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
              >
                {uploading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    画像をアップロード中...
                  </>
                ) : loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    作成中...
                  </>
                ) : (
                  '作成'
                )}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
