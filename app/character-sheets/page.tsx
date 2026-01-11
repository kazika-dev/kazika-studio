'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Container,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Download as DownloadIcon, Star as StarIcon, StarBorder as StarBorderIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

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
  is_favorite: boolean;
}

export default function CharacterSheetsPage() {
  const router = useRouter();
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CharacterSheet | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadCharacterSheets();
  }, []);

  const loadCharacterSheets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/character-sheets');
      const data = await response.json();

      if (data.success) {
        setCharacterSheets(data.characterSheets);
      } else {
        toast.error('キャラクターシートの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load character sheets:', error);
      toast.error('キャラクターシートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSheet) return;

    try {
      const response = await fetch(`/api/character-sheets/${selectedSheet.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('キャラクターシートを削除しました');
        loadCharacterSheets();
      } else {
        toast.error('キャラクターシートの削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete character sheet:', error);
      toast.error('キャラクターシートの削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedSheet(null);
    }
  };

  const handleNewSheet = () => {
    router.push('/character-sheets/new');
  };

  const handleEdit = (sheet: CharacterSheet) => {
    router.push(`/character-sheets/${sheet.id}/edit`);
  };

  const handleToggleFavorite = async (sheet: CharacterSheet) => {
    try {
      const response = await fetch(`/api/character-sheets/${sheet.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_favorite: !sheet.is_favorite,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // ローカル状態を更新してリロード（ソート順が変わるため）
        toast.success(sheet.is_favorite ? 'お気に入りを解除しました' : 'お気に入りに追加しました');
        loadCharacterSheets();
      } else {
        toast.error('お気に入りの更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast.error('お気に入りの更新に失敗しました');
    }
  };

  const handleDownload = async (sheet: CharacterSheet) => {
    try {
      const imageUrl = getImageUrl(sheet.image_url);
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // ファイル名を生成（キャラクター名 + 拡張子）
      const contentType = response.headers.get('content-type') || 'image/png';
      const extension = contentType.split('/')[1] || 'png';
      link.download = `${sheet.name}.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('ダウンロードを開始しました');
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('ダウンロードに失敗しました');
    }
  };

  const getImageUrl = (imageUrl: string) => {
    // 既に絶対URLまたはAPI経由のURLの場合はそのまま返す
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/api/')) {
      return imageUrl;
    }
    // 相対パスの場合はストレージプロキシAPIを経由
    return `/api/storage/${imageUrl}`;
  };

  // クライアントサイドでマウントされるまで何も表示しない（Hydrationエラー回避）
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Toaster position="top-center" />

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            キャラクターシート
          </Typography>
          <Typography variant="body2" color="text.secondary">
            キャラクターシート画像を管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewSheet}
        >
          新規作成
        </Button>
      </Box>

      {characterSheets.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              キャラクターシートがまだありません
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewSheet}
              sx={{ mt: 2 }}
            >
              最初のキャラクターシートを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {characterSheets.map((sheet) => (
            <Card key={sheet.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* お気に入りボタン（画像右上に配置） */}
              <IconButton
                size="small"
                onClick={() => handleToggleFavorite(sheet)}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 1)',
                  },
                }}
              >
                {sheet.is_favorite ? (
                  <StarIcon sx={{ color: 'warning.main' }} />
                ) : (
                  <StarBorderIcon sx={{ color: 'action.active' }} />
                )}
              </IconButton>
              <CardMedia
                component="img"
                image={getImageUrl(sheet.image_url)}
                alt={sheet.name}
                sx={{ aspectRatio: '3/4', objectFit: 'cover' }}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  {sheet.name}
                </Typography>
                {sheet.description && (
                  <Typography variant="body2" color="text.secondary">
                    {sheet.description}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(sheet)}
                >
                  編集
                </Button>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownload(sheet)}
                >
                  ダウンロード
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    setSelectedSheet(sheet);
                    setDeleteDialogOpen(true);
                  }}
                >
                  削除
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>キャラクターシートを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は取り消せません。キャラクターシート「{selectedSheet?.name}」を削除してもよろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleDelete} color="error" autoFocus>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
