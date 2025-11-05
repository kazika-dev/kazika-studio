'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { FormFieldConfig } from '@/components/form/DynamicFormField';
import { Node } from 'reactflow';
import { extractFormFieldsFromNodes } from '@/lib/workflow/formConfigGenerator';

interface FormConfigEditorProps {
  nodes: Node[];
}

export default function FormConfigEditor({ nodes }: FormConfigEditorProps) {
  const [open, setOpen] = useState(false);

  // ノードから自動抽出されるフィールド
  const autoFields = extractFormFieldsFromNodes(nodes);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<SettingsIcon />}
        onClick={handleOpen}
        size="small"
      >
        フォーム設定 {autoFields.length > 0 && `(${autoFields.length})`}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          フォーム設定（自動検出）
          <Typography variant="caption" display="block" color="text.secondary">
            ワークフロー内のノードから自動的に検出されたフィールドです
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* 自動抽出されたフィールド */}
            {autoFields.length > 0 ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AutoFixHighIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={600}>
                    検出されたフィールド
                  </Typography>
                </Box>
                <Stack spacing={1}>
                  {autoFields.map((field: FormFieldConfig, index: number) => (
                    <Paper key={index} variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {field.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            タイプ: {field.type}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            名前: {field.name}
                          </Typography>
                          {field.placeholder && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              プレースホルダー: {field.placeholder}
                            </Typography>
                          )}
                        </Box>
                        <Chip label="自動" size="small" color="primary" variant="outlined" />
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  検出可能なフィールドがありません
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  入力ノード、画像入力ノード、またはAIノード（Gemini/Nanobana等）を追加してください
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
