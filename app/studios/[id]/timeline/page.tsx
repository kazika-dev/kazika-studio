'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Box, Button, CircularProgress, Alert, Container } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BoardTimelineContainer from '@/components/studio/timeline/BoardTimelineContainer';
import { Board } from '@/components/studio/timeline/boardTypes';

export default function TimelineViewPage() {
  const router = useRouter();
  const params = useParams();

  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const studioId = idParam ? parseInt(idParam, 10) : NaN;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    if (!isNaN(studioId) && studioId > 0) {
      loadBoards();
    } else if (idParam !== undefined) {
      setError('無効なスタジオIDです');
      setLoading(false);
    }
  }, [studioId, idParam]);

  const loadBoards = async () => {
    try {
      setLoading(true);
      setError(null);

      // スタジオのボード一覧を取得
      const boardsResponse = await fetch(`/api/studios/${studioId}/boards`);
      const boardsData = await boardsResponse.json();

      if (!boardsData.success) {
        setError(boardsData.error || 'ボードの読み込みに失敗しました');
        return;
      }

      setBoards(boardsData.boards);
    } catch (err: any) {
      console.error('Failed to load boards:', err);
      setError('ボードの読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/studios/${studioId}`)}
          sx={{ mt: 2 }}
        >
          スタジオに戻る
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* 戻るボタン */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
        }}
      >
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/studios/${studioId}`)}
          sx={{
            bgcolor: 'rgba(45, 45, 45, 0.95)',
            '&:hover': {
              bgcolor: 'rgba(45, 45, 45, 1)',
            },
          }}
        >
          スタジオに戻る
        </Button>
      </Box>

      {/* ボードベースのタイムライン */}
      <BoardTimelineContainer studioId={studioId} boards={boards} />
    </Box>
  );
}
