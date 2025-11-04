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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
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

export default function CharacterSheetsPage() {
  const router = useRouter();
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CharacterSheet | null>(null);

  useEffect(() => {
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
            <Card key={sheet.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardMedia
                component="img"
                image={sheet.image_url}
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
