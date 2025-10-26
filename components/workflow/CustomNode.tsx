'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Box, Typography, alpha } from '@mui/material';
import InputIcon from '@mui/icons-material/Input';
import SettingsIcon from '@mui/icons-material/Settings';
import OutputIcon from '@mui/icons-material/Output';

interface CustomNodeData {
  label: string;
  type: 'input' | 'process' | 'output';
  config: {
    name: string;
    description: string;
  };
}

function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  const getNodeConfig = () => {
    switch (data.type) {
      case 'input':
        return {
          color: '#1976d2',
          icon: InputIcon,
          lightBg: alpha('#1976d2', 0.08),
        };
      case 'process':
        return {
          color: '#2e7d32',
          icon: SettingsIcon,
          lightBg: alpha('#2e7d32', 0.08),
        };
      case 'output':
        return {
          color: '#9c27b0',
          icon: OutputIcon,
          lightBg: alpha('#9c27b0', 0.08),
        };
      default:
        return {
          color: '#757575',
          icon: SettingsIcon,
          lightBg: alpha('#757575', 0.08),
        };
    }
  };

  const config = getNodeConfig();
  const NodeIcon = config.icon;

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        position: 'relative',
        minWidth: 220,
        p: 2,
        border: selected ? `2px solid ${config.color}` : '1px solid',
        borderColor: selected ? config.color : 'divider',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        bgcolor: 'background.paper',
        '&:hover': {
          elevation: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      {data.type !== 'input' && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            width: 12,
            height: 12,
            backgroundColor: config.color,
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: config.lightBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NodeIcon sx={{ fontSize: 20, color: config.color }} />
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

      {data.type !== 'output' && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            width: 12,
            height: 12,
            backgroundColor: config.color,
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      )}
    </Paper>
  );
}

export default memo(CustomNode);
