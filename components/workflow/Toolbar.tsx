'use client';

import { Paper, Box, Typography, Button, Divider, Stack } from '@mui/material';
import InputIcon from '@mui/icons-material/Input';
import SettingsIcon from '@mui/icons-material/Settings';
import OutputIcon from '@mui/icons-material/Output';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ImageIcon from '@mui/icons-material/Image';
import CollectionsIcon from '@mui/icons-material/Collections';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

interface ToolbarProps {
  onAddNode: (type: 'input' | 'process' | 'output' | 'gemini' | 'nanobana' | 'imageInput' | 'elevenlabs') => void;
}

export default function Toolbar({ onAddNode }: ToolbarProps) {
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 24,
        left: 24,
        zIndex: 10,
        p: 2.5,
        minWidth: 240,
        bgcolor: 'background.paper',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AddIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={600}>
          ノードを追加
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<InputIcon />}
          onClick={() => onAddNode('input')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
          }}
        >
          入力ノード
        </Button>

        <Button
          fullWidth
          variant="contained"
          color="success"
          startIcon={<SettingsIcon />}
          onClick={() => onAddNode('process')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
          }}
        >
          処理ノード
        </Button>

        <Button
          fullWidth
          variant="contained"
          color="secondary"
          startIcon={<OutputIcon />}
          onClick={() => onAddNode('output')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
          }}
        >
          出力ノード
        </Button>

        <Divider sx={{ my: 1 }} />

        <Button
          fullWidth
          variant="contained"
          startIcon={<CollectionsIcon />}
          onClick={() => onAddNode('imageInput')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
            bgcolor: '#9c27b0',
            '&:hover': {
              bgcolor: '#7b1fa2',
            },
          }}
        >
          画像入力
        </Button>

        <Button
          fullWidth
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => onAddNode('gemini')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
            bgcolor: '#ea80fc',
            '&:hover': {
              bgcolor: '#d500f9',
            },
          }}
        >
          Gemini AI
        </Button>

        <Button
          fullWidth
          variant="contained"
          startIcon={<ImageIcon />}
          onClick={() => onAddNode('nanobana')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
            bgcolor: '#ff6b9d',
            '&:hover': {
              bgcolor: '#ff4081',
            },
          }}
        >
          Nanobana 画像生成
        </Button>

        <Button
          fullWidth
          variant="contained"
          startIcon={<RecordVoiceOverIcon />}
          onClick={() => onAddNode('elevenlabs')}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            py: 1,
            bgcolor: '#4fc3f7',
            '&:hover': {
              bgcolor: '#29b6f6',
            },
          }}
        >
          ElevenLabs 音声合成
        </Button>
      </Stack>
    </Paper>
  );
}
