'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, Chip } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';

interface PopcornNodeData {
  label: string;
  type: 'popcorn';
  config: {
    name: string;
    description: string;
    prompt: string;
    aspectRatio?: string;
    count?: number;
    quality?: string;
    seed?: number;
    imageUrls?: string[];
    status?: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
  };
}

function PopcornNode({ data, selected }: NodeProps<PopcornNodeData>) {
  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        position: 'relative',
        minWidth: 280,
        p: 2,
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? '#ff6b6b' : 'divider',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        bgcolor: 'background.paper',
        '&:hover': {
          elevation: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 12,
          height: 12,
          backgroundColor: '#ff6b6b',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(255, 107, 107, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageIcon sx={{ fontSize: 20, color: '#ff6b6b' }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 0.5,
              lineHeight: 1.3,
            }}
          >
            {data.config.name}
          </Typography>
          {data.config.description && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.4,
              }}
            >
              {data.config.description}
            </Typography>
          )}
        </Box>
      </Box>

      {data.config.prompt && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
            color: 'text.secondary',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.config.prompt}
        </Typography>
      )}

      {/* 設定の表示 */}
      {(data.config.aspectRatio || data.config.count || data.config.quality) && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {data.config.aspectRatio && (
            <Chip
              label={data.config.aspectRatio}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 107, 107, 0.1)',
                color: '#ff6b6b',
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          )}
          {data.config.count !== undefined && data.config.count > 1 && (
            <Chip
              label={`${data.config.count}枚`}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 107, 107, 0.1)',
                color: '#ff6b6b',
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          )}
          {data.config.quality && (
            <Chip
              label={data.config.quality}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 107, 107, 0.1)',
                color: '#ff6b6b',
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          )}
        </Box>
      )}

      {/* 画像プレビュー */}
      {data.config.imageUrls && data.config.imageUrls.length > 0 && (
        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: data.config.imageUrls.length === 1 ? '1fr' : 'repeat(2, 1fr)',
            gap: 0.5,
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {data.config.imageUrls.map((url, index) => (
            <Box
              key={index}
              sx={{
                position: 'relative',
                paddingBottom: '100%',
                bgcolor: 'action.hover',
              }}
            >
              <img
                src={url}
                alt={`Generated ${index + 1}`}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Box>
          ))}
        </Box>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 12,
          height: 12,
          backgroundColor: '#ff6b6b',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </Paper>
  );
}

export default memo(PopcornNode);
