'use client';

import { Node } from 'reactflow';
import { Paper, Box, Typography, Button, Divider, Stack } from '@mui/material';
import InputIcon from '@mui/icons-material/Input';
import SettingsIcon from '@mui/icons-material/Settings';
import OutputIcon from '@mui/icons-material/Output';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface ToolbarProps {
  onAddNode: (type: 'input' | 'process' | 'output' | 'gemini') => void;
  onDeleteNode: () => void;
  selectedNode: Node | null;
}

export default function Toolbar({ onAddNode, onDeleteNode, selectedNode }: ToolbarProps) {
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
      </Stack>

      {selectedNode && (
        <>
          <Divider sx={{ my: 2 }} />
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDeleteNode}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              py: 1,
            }}
          >
            選択ノードを削除
          </Button>
        </>
      )}
    </Paper>
  );
}
