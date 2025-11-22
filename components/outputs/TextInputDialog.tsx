'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
} from '@mui/icons-material';

interface TextInputDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TextConfig) => void;
}

export interface TextConfig {
  text: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
}

export default function TextInputDialog({ open, onClose, onConfirm }: TextInputDialogProps) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [color, setColor] = useState('#000000');

  const handleConfirm = () => {
    if (!text.trim()) return;

    onConfirm({
      text,
      fontSize,
      fontWeight,
      fontStyle,
      color,
    });

    // リセット
    setText('');
    setFontSize(32);
    setFontWeight('normal');
    setFontStyle('normal');
    setColor('#000000');
    onClose();
  };

  const handleClose = () => {
    setText('');
    onClose();
  };

  const colors = [
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
  ];

  const toggleFontWeight = () => {
    setFontWeight(fontWeight === 'normal' ? 'bold' : 'normal');
  };

  const toggleFontStyle = () => {
    setFontStyle(fontStyle === 'normal' ? 'italic' : 'normal');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>テキストを追加</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="テキスト"
            multiline
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            fullWidth
            autoFocus
          />

          <Box>
            <Typography variant="body2" gutterBottom>
              フォントサイズ: {fontSize}px
            </Typography>
            <Slider
              value={fontSize}
              onChange={(_, value) => setFontSize(value as number)}
              min={12}
              max={120}
              step={2}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2">スタイル:</Typography>
            <ToggleButton
              value="bold"
              selected={fontWeight === 'bold'}
              onChange={toggleFontWeight}
              size="small"
              title="太字"
            >
              <FormatBold />
            </ToggleButton>
            <ToggleButton
              value="italic"
              selected={fontStyle === 'italic'}
              onChange={toggleFontStyle}
              size="small"
              title="斜体"
            >
              <FormatItalic />
            </ToggleButton>
          </Box>

          <Box>
            <Typography variant="body2" gutterBottom>
              色:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {colors.map((c) => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: c,
                    border: color === c ? '3px solid #1976d2' : '1px solid #ccc',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              p: 2,
              bgcolor: '#f5f5f5',
              borderRadius: 1,
              minHeight: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: `${Math.min(fontSize, 48)}px`,
                fontWeight,
                fontStyle,
                color,
              }}
            >
              {text || 'プレビュー'}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!text.trim()}>
          追加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
