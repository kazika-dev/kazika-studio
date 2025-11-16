'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ImageEditor from '@/components/outputs/ImageEditor';
import { CircularProgress, Box, Typography } from '@mui/material';

export default function EditOutputPage() {
  const params = useParams();
  const id = params.id as string;
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOutput = async () => {
      try {
        const response = await fetch(`/api/outputs?id=${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch output');
        }

        const data = await response.json();
        if (data.success && data.outputs && data.outputs.length > 0) {
          const foundOutput = data.outputs[0];
          if (foundOutput.output_type !== 'image') {
            throw new Error('このアウトプットは画像ではありません');
          }
          setOutput(foundOutput);
        } else {
          throw new Error('アウトプットが見つかりません');
        }
      } catch (err) {
        console.error('Error fetching output:', err);
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOutput();
    }
  }, [id]);

  // URLまたはパスに応じて適切なsrcを返す
  const getImageSrc = (contentUrl: string) => {
    if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
      return contentUrl;
    }
    return `/api/storage/${contentUrl}`;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography color="error" variant="h6">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!output || !output.content_url) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Typography>画像が見つかりません</Typography>
      </Box>
    );
  }

  return (
    <ImageEditor
      imageUrl={getImageSrc(output.content_url)}
      originalOutputId={id}
    />
  );
}
