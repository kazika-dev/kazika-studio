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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

interface ElevenLabsTag {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export default function EditElevenLabsTagPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tag, setTag] = useState<ElevenLabsTag | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadTag();
  }, [id]);

  const loadTag = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/eleven-labs-tags/${id}`);
      const data = await response.json();

      if (data.success) {
        setTag(data.tag);
        setName(data.tag.name);
        setDescription(data.tag.description || '');
      } else {
        toast.error('タグの取得に失敗しました');
        router.push('/eleven-labs-tags');
      }
    } catch (error) {
      console.error('Failed to load tag:', error);
      toast.error('タグの取得に失敗しました');
      router.push('/eleven-labs-tags');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('タグ名を入力してください');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/eleven-labs-tags/${id}`, {
        method: 'PATCH',
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
        toast.success('タグを更新しました');
        router.push('/eleven-labs-tags');
      } else {
        toast.error(data.error || 'タグの更新に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to update tag:', error);
      toast.error(error.message || 'タグの更新に失敗しました');
    } finally {
      setSaving(false);
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
            ElevenLabsタグ編集
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            タグ情報を更新します
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="タグ名"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
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
              disabled={saving}
              placeholder="タグの詳細な説明を入力してください"
            />

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
                {saving ? (
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
