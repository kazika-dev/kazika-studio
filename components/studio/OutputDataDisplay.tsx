'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import Image from 'next/image';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

interface OutputDataDisplayProps {
  output: any;
  nodeType: string;
}

export default function OutputDataDisplay({ output, nodeType }: OutputDataDisplayProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // 画像出力の表示
  if (output.imageData || output.imageUrl || output.storagePath) {
    const imageUrl = output.imageUrl || output.imageData;

    const handleImageClick = () => {
      setSelectedImageUrl(imageUrl);
      setImageDialogOpen(true);
    };

    return (
      <>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 400,
            aspectRatio: '16/9',
            bgcolor: 'grey.100',
            borderRadius: 1,
            overflow: 'hidden',
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.8,
            },
          }}
          onClick={handleImageClick}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="Output"
              fill
              style={{ objectFit: 'contain' }}
              unoptimized
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                画像をロード中...
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.6)',
              borderRadius: 1,
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <ZoomInIcon fontSize="small" sx={{ color: 'white' }} />
            <Typography variant="caption" sx={{ color: 'white' }}>
              クリックで拡大
            </Typography>
          </Box>
        </Box>

        {/* 画像拡大ダイアログ */}
        <Dialog
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0, bgcolor: 'black' }}>
            {selectedImageUrl && (
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '60vh',
                  maxHeight: '80vh',
                }}
              >
                <Image
                  src={selectedImageUrl}
                  alt="Output (拡大)"
                  fill
                  style={{ objectFit: 'contain' }}
                  unoptimized
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImageDialogOpen(false)}>閉じる</Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // 動画出力の表示
  if (output.videoUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          maxWidth: 400,
          bgcolor: 'grey.100',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <video
          src={output.videoUrl}
          controls
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      </Box>
    );
  }

  // 音声出力の表示
  if (output.audioData || output.audioUrl) {
    const audioSrc = output.audioUrl || output.audioData;

    return (
      <Box
        sx={{
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
          border: 1,
          borderColor: 'grey.200',
        }}
      >
        <audio
          src={audioSrc}
          controls
          style={{
            width: '100%',
          }}
        />
      </Box>
    );
  }

  // テキスト出力の表示
  if (output.text || output.prompt) {
    const textContent = output.text || output.prompt;

    return (
      <Box
        sx={{
          p: 1.5,
          bgcolor: 'grey.50',
          borderRadius: 1,
          border: 1,
          borderColor: 'grey.200',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {textContent}
        </Typography>
      </Box>
    );
  }

  // JSON形式で全データを表示（フォールバック）
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: 'grey.50',
        borderRadius: 1,
        border: 1,
        borderColor: 'grey.200',
      }}
    >
      <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(output, null, 2)}
      </pre>
    </Box>
  );
}
