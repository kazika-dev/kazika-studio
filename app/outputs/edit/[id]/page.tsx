'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ImageEditor from '@/components/common/ImageEditor';
import { CircularProgress, Box, Typography } from '@mui/material';

export default function EditOutputPage() {
  const params = useParams();
  const router = useRouter();
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
      onSave={async (blob, saveMode?: 'overwrite' | 'new') => {
        try {
          const formData = new FormData();
          formData.append('file', blob, 'edited-image.png');

          let response;
          let successMessage;

          if (saveMode === 'new') {
            // 新規保存: 元のoutputの情報をコピーして新しいoutputとして保存
            formData.append('originalOutputId', id);
            formData.append('prompt', output.prompt ? `${output.prompt} (編集済み)` : 'Edited image');

            response = await fetch('/api/outputs/save-edited', {
              method: 'POST',
              body: formData,
            });
            successMessage = '新しい画像として保存しました';
          } else {
            // 上書き保存（デフォルト）: 既存のoutputを更新
            response = await fetch(`/api/outputs/${id}/replace-image`, {
              method: 'PUT',
              body: formData,
            });
            successMessage = '画像を更新しました';
          }

          const data = await response.json();

          if (!response.ok || !data.success) {
            console.error('Save error:', data);
            throw new Error(data.error || 'Failed to save image');
          }

          alert(successMessage);
          router.push('/outputs');
        } catch (err) {
          console.error('Error saving image:', err);
          alert('画像の保存に失敗しました: ' + (err instanceof Error ? err.message : ''));
        }
      }}
      onClose={() => {
        router.push('/outputs');
      }}
      enableSaveModeSelection={true}
    />
  );
}
