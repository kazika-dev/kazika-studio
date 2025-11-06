'use client';

import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  Paper,
  Drawer,
  IconButton,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

interface ComfyUINodeSettingsProps {
  nodeId: string;
  config: {
    name: string;
    description: string;
    workflowName: string;
    workflowJson: any;
    prompt?: string;
  };
  onUpdate: (nodeId: string, updates: any) => void;
  onClose?: () => void;
  onDelete?: () => void;
}

export default function ComfyUINodeSettings({
  nodeId,
  config,
  onUpdate,
  onClose,
  onDelete,
}: ComfyUINodeSettingsProps) {
  const [name, setName] = useState(config.name || '');
  const [description, setDescription] = useState(config.description || '');
  const [workflowName, setWorkflowName] = useState(config.workflowName || '');
  const [workflowJsonStr, setWorkflowJsonStr] = useState(
    config.workflowJson ? JSON.stringify(config.workflowJson, null, 2) : ''
  );
  const [prompt, setPrompt] = useState(config.prompt || '');
  const [jsonError, setJsonError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleWorkflowJsonChange = (value: string) => {
    setWorkflowJsonStr(value);

    // Validate JSON
    if (value.trim()) {
      try {
        JSON.parse(value);
        setJsonError('');
      } catch (error: any) {
        setJsonError(`JSON形式が不正です: ${error.message}`);
      }
    } else {
      setJsonError('');
    }
  };

  const handleSave = () => {
    let parsedWorkflowJson = null;

    if (workflowJsonStr.trim()) {
      try {
        parsedWorkflowJson = JSON.parse(workflowJsonStr);
      } catch (error: any) {
        setJsonError(`JSON形式が不正です: ${error.message}`);
        return;
      }
    }

    onUpdate(nodeId, {
      config: {
        name,
        description,
        workflowName,
        workflowJson: parsedWorkflowJson,
        prompt,
      },
    });

    setSaveSuccess(true);
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={true}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            p: 0,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            ComfyUI ワークフロー設定
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField
          label="ノード名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          variant="outlined"
        />

        <TextField
          label="説明"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={2}
          variant="outlined"
        />

        <TextField
          label="ワークフロー名"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          fullWidth
          variant="outlined"
          required
          helperText="例: Qwen-Image-Edit, Stable-Diffusion-XL, etc."
        />

        <Box>
          <TextField
            label="ワークフローJSON定義"
            value={workflowJsonStr}
            onChange={(e) => handleWorkflowJsonChange(e.target.value)}
            fullWidth
            multiline
            rows={12}
            variant="outlined"
            required
            error={!!jsonError}
            helperText={jsonError || 'ComfyUIのワークフロー定義をJSON形式で入力してください'}
            sx={{
              '& textarea': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
            }}
          />
          {!jsonError && workflowJsonStr.trim() && (
            <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
              ✓ JSON形式が正しいです
            </Typography>
          )}
        </Box>

        <TextField
          label="プロンプト（オプション）"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          helperText="前のノードからの入力と組み合わせて使用されます"
        />

        <Paper sx={{ p: 2, bgcolor: 'info.lighter' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>使い方:</strong>
            <br />
            1. ワークフロー名を入力（例: "Qwen-Image-Edit"）
            <br />
            2. ComfyUIのワークフロー定義（JSON）を貼り付け
            <br />
            3. 必要に応じてプロンプトを設定
            <br />
            4. 前のノードから画像を受け取る場合は、画像入力ノードを接続
            <br />
            5. 実行すると、データベースのキューに追加されます
          </Typography>
        </Paper>

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!!jsonError || !workflowName.trim() || !workflowJsonStr.trim()}
              fullWidth
              sx={{
                mt: 2,
                bgcolor: '#4caf50',
                '&:hover': {
                  bgcolor: '#45a049',
                },
              }}
            >
              設定を保存
            </Button>
          </Box>
        </Box>

        <Divider />
        <Box sx={{ p: 2 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            fullWidth
          >
            ノードを削除
          </Button>
        </Box>
      </Drawer>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)}>
          設定を保存しました
        </Alert>
      </Snackbar>
    </>
  );
}
