'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Paper, Typography } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';

export default memo(function ImageInputNode({ data, selected }: NodeProps) {
  const hasImage = data.config?.imageData;

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        px: 2,
        py: 1.5,
        minWidth: 200,
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 4,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <ImageIcon sx={{ color: '#9c27b0', fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight={600}>
          {data.config?.name || '画像入力'}
        </Typography>
      </Box>

      {data.config?.description && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1 }}
        >
          {data.config.description}
        </Typography>
      )}

      {hasImage && (
        <Box
          sx={{
            mt: 1,
            p: 0.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <img
            src={`data:${data.config.imageData.mimeType};base64,${data.config.imageData.data}`}
            alt="Input"
            style={{
              maxWidth: '100%',
              maxHeight: '80px',
              objectFit: 'contain',
              borderRadius: '4px',
            }}
          />
        </Box>
      )}

      {!hasImage && (
        <Typography variant="caption" color="text.secondary">
          画像が設定されていません
        </Typography>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#9c27b0',
          width: 10,
          height: 10,
        }}
      />
    </Paper>
  );
});
