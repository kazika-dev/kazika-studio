'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import { getNodeTypeConfig } from '@/lib/workflow/formConfigGenerator';

interface NodeInputEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (inputs: Record<string, any>) => Promise<void>;
  nodeType: string;
  nodeId: string;
  currentInputs?: Record<string, any>;
}

export default function NodeInputEditDialog({
  open,
  onClose,
  onSave,
  nodeType,
  nodeId,
  currentInputs = {},
}: NodeInputEditDialogProps) {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // ノードタイプの設定を取得
  const nodeConfig = getNodeTypeConfig(nodeType);

  // currentInputsが変更されたら、inputsを初期化
  useEffect(() => {
    if (open) {
      setInputs({ ...currentInputs });
    }
  }, [open, currentInputs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(inputs);
      onClose();
    } catch (error) {
      console.error('Failed to save inputs:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (fieldName: string, value: any) => {
    setInputs((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // フィールドの表示名を取得
  const getFieldLabel = (fieldName: string): string => {
    const field = nodeConfig.fields.find((f) => f.name === fieldName);
    return field?.label || fieldName;
  };

  // フィールドのタイプを取得
  const getFieldType = (fieldName: string): string => {
    const field = nodeConfig.fields.find((f) => f.name === fieldName);
    return field?.type || 'text';
  };

  // フィールドのオプションを取得（selectフィールド用）
  const getFieldOptions = (fieldName: string): Array<{ value: string; label: string }> => {
    const field = nodeConfig.fields.find((f) => f.name === fieldName);
    return field?.options || [];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        ノード入力を編集
        <Typography variant="caption" display="block" color="text.secondary">
          {nodeId}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {nodeConfig.fields.map((field) => {
            const fieldValue = inputs[field.name] ?? field.defaultValue ?? '';

            // テキストフィールド
            if (field.type === 'text' || field.type === 'textarea') {
              return (
                <TextField
                  key={field.name}
                  label={field.label}
                  value={fieldValue}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  multiline={field.type === 'textarea'}
                  rows={field.type === 'textarea' ? 4 : 1}
                  fullWidth
                  placeholder={field.placeholder}
                />
              );
            }

            // セレクトフィールド
            if (field.type === 'select' && field.options) {
              return (
                <FormControl key={field.name} fullWidth>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    value={fieldValue}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    label={field.label}
                  >
                    {field.options.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            // 数値フィールド
            if (field.type === 'number' || field.type === 'slider') {
              return (
                <TextField
                  key={field.name}
                  label={field.label}
                  type="number"
                  value={fieldValue}
                  onChange={(e) => handleChange(field.name, parseFloat(e.target.value))}
                  fullWidth
                  inputProps={{
                    min: field.min,
                    max: field.max,
                    step: field.step,
                  }}
                />
              );
            }

            // 編集不可のフィールド（characterSheetSelector, imageUpload, outputSelectorなど）
            if (
              field.type === 'characterSheetSelector' ||
              field.type === 'imageUpload' ||
              field.type === 'outputSelector'
            ) {
              return (
                <Box key={field.name}>
                  <Typography variant="subtitle2" gutterBottom>
                    {field.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    このフィールドは現在編集できません（ワークフローエディタで設定してください）
                  </Typography>
                  {Array.isArray(fieldValue) && fieldValue.length > 0 && (
                    <Box mt={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {fieldValue.map((id: any, index: number) => (
                          <Chip key={index} label={`ID: ${id}`} size="small" />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              );
            }

            // その他のフィールドタイプ
            return (
              <Box key={field.name}>
                <Typography variant="subtitle2" gutterBottom>
                  {field.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  タイプ: {field.type}
                </Typography>
                <TextField
                  value={JSON.stringify(fieldValue)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleChange(field.name, parsed);
                    } catch {
                      handleChange(field.name, e.target.value);
                    }
                  }}
                  fullWidth
                  multiline
                  rows={2}
                  sx={{ mt: 1 }}
                />
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
