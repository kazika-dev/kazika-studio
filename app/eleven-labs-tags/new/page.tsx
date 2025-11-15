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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

export default function NewElevenLabsTagPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('タグ名を入力してください');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/eleven-labs-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('タグを作成しました');
        router.push('/eleven-labs-tags');
      } else {
        toast.error(data.error || 'タグの作成に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to create tag:', error);
      toast.error(error.message || 'タグの作成に失敗しました');
    } finally {
      setLoading(false);
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
            ElevenLabsタグ新規作成
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            ElevenLabsで使用するタグを登録します
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="タグ名"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="例: frustrated, cheerful, calm"
              helperText="ElevenLabsで使用するタグ名を入力してください"
            />

            <TextField
              label="説明（任意）"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="タグの詳細な説明を入力してください"
            />

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
                {loading ? (
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
