'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Paper, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

export default memo(function CharacterSheetNode({ data, selected }: NodeProps) {
  const characterSheet = data.config?.characterSheet;
  const imageUrl = characterSheet?.image_url;

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
        <PersonIcon sx={{ color: '#ff6b9d', fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight={600}>
          {data.config?.name || 'キャラクターシート'}
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

      {characterSheet && (
        <Box>
          <Box
            sx={{
              mt: 1,
              p: 0.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {imageUrl && (
              <img
                src={imageUrl.startsWith('http') ? imageUrl : `/api/storage/${imageUrl}`}
                alt={characterSheet.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80px',
                  objectFit: 'contain',
                  borderRadius: '4px',
                }}
              />
            )}
            <Typography variant="caption" fontWeight={600}>
              {characterSheet.name}
            </Typography>
          </Box>
        </Box>
      )}

      {!characterSheet && (
        <Typography variant="caption" color="text.secondary">
          キャラクターシートが選択されていません
        </Typography>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#ff6b9d',
          width: 10,
          height: 10,
        }}
      />
    </Paper>
  );
});
