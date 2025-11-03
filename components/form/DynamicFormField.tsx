'use client';

import { useRef } from 'react';
import {
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  IconButton,
  Alert,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';

export interface FormFieldConfig {
  type: 'text' | 'textarea' | 'image' | 'images' | 'prompt';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxImages?: number;
  helperText?: string;
}

interface DynamicFormFieldProps {
  config: FormFieldConfig;
  value: any;
  onChange: (value: any) => void;
}

export default function DynamicFormField({ config, value, onChange }: DynamicFormFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxImages = config.maxImages || 1;
    const currentCount = config.type === 'images' ? (value?.length || 0) : (value ? 1 : 0);

    const newImages: Array<{ mimeType: string; data: string }> = [];

    Array.from(files).forEach((file, index) => {
      if (currentCount + newImages.length >= maxImages) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('画像ファイルのみアップロードできます');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} のサイズが5MBを超えています`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];

        newImages.push({
          mimeType: file.type,
          data: base64Data,
        });

        // 全ての画像の読み込みが完了したら state を更新
        if (newImages.length === Math.min(files.length, maxImages - currentCount)) {
          if (config.type === 'images') {
            onChange([...(value || []), ...newImages]);
          } else {
            onChange(newImages[0]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    if (config.type === 'images') {
      onChange((value || []).filter((_: any, i: number) => i !== index));
    } else {
      onChange(null);
    }
  };

  // テキスト入力系
  if (config.type === 'text' || config.type === 'textarea' || config.type === 'prompt') {
    return (
      <Box>
        <TextField
          label={config.label}
          fullWidth
          multiline={config.type !== 'text'}
          rows={config.rows || (config.type === 'prompt' ? 4 : 3)}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder}
          required={config.required}
          helperText={config.helperText}
          variant="outlined"
        />
      </Box>
    );
  }

  // 画像アップロード（単一）
  if (config.type === 'image') {
    return (
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {config.label}
          {config.required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
        {config.helperText && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {config.helperText}
          </Typography>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />

        {!value && (
          <Button
            variant="outlined"
            fullWidth
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              py: 1.5,
              borderStyle: 'dashed',
              borderWidth: 2,
            }}
          >
            画像を選択
          </Button>
        )}

        {value && (
          <Paper variant="outlined" sx={{ p: 1, position: 'relative' }}>
            <IconButton
              size="small"
              onClick={() => handleRemoveImage(0)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'background.paper',
                '&:hover': { bgcolor: 'error.light', color: 'white' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
            <img
              src={`data:${value.mimeType};base64,${value.data}`}
              alt="Upload"
              style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '4px' }}
            />
          </Paper>
        )}
      </Box>
    );
  }

  // 画像アップロード（複数）
  if (config.type === 'images') {
    const images = value || [];
    const maxImages = config.maxImages || 8;

    return (
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {config.label}
          {config.required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
        {config.helperText && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {config.helperText}
          </Typography>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />

        <Button
          variant="outlined"
          fullWidth
          startIcon={<UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= maxImages}
          sx={{
            py: 1.5,
            borderStyle: 'dashed',
            borderWidth: 2,
          }}
        >
          画像を追加 ({images.length}/{maxImages})
        </Button>

        {images.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {images.map((img: any, index: number) => (
              <Box key={index} sx={{ width: 'calc(50% - 8px)', position: 'relative' }}>
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveImage(index)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'error.light', color: 'white' },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={`Upload ${index + 1}`}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                </Paper>
              </Box>
            ))}
          </Box>
        )}

        {config.required && images.length === 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            少なくとも1枚の画像が必要です
          </Alert>
        )}
      </Box>
    );
  }

  return null;
}
