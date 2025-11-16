'use client';

import { useRef, useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  IconButton,
  Alert,
  Card,
  CardContent,
  CardMedia,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
  MenuItem,
  Slider,
  Switch,
  Stack,
  Chip,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';

export interface FormFieldConfig {
  type: 'text' | 'textarea' | 'image' | 'images' | 'prompt' | 'characterSheet' | 'characterSheets' | 'select' | 'slider' | 'switch' | 'tags';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxImages?: number;
  maxSelections?: number;
  helperText?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  targetFieldName?: string; // タグ挿入先のフィールド名
}

interface DynamicFormFieldProps {
  config: FormFieldConfig;
  value: any;
  onChange: (value: any) => void;
  allValues?: Record<string, any>; // 全フィールドの値（タグ挿入用）
  onFieldChange?: (fieldName: string, value: any) => void; // 他フィールド更新用
}

export default function DynamicFormField({ config, value, onChange, allValues, onFieldChange }: DynamicFormFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxImages = config.maxImages || 1;
    const currentCount = config.type === 'images' ? (value?.length || 0) : (value ? 1 : 0);

    if (currentCount >= maxImages) {
      alert(`最大${maxImages}枚まで選択できます`);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).slice(0, maxImages - currentCount).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name}は画像ファイルではありません`);
        }

        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name}のサイズが5MBを超えています`);
        }

        // FileをBase64に変換
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            resolve(base64.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // GCP Storageにアップロード（/referenceフォルダに保存）
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Data,
            mimeType: file.type,
            fileName: file.name,
            folder: 'reference', // ワークフロー参照画像は/referenceフォルダに保存
          }),
        });

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
          throw new Error(uploadData.error || '画像のアップロードに失敗しました');
        }

        console.log('[DynamicFormField] Image uploaded to GCP Storage:', uploadData.storagePath);

        // storagePathを返す（base64データは保存しない）
        return uploadData.storagePath;
      });

      const uploadedPaths = await Promise.all(uploadPromises);

      if (config.type === 'images') {
        onChange([...(value || []), ...uploadedPaths]);
      } else {
        onChange(uploadedPaths[0]);
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      alert(`画像のアップロードに失敗しました: ${error.message}`);
    } finally {
      setUploading(false);
    }
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
          helperText={config.helperText}
          variant="outlined"
        />
      </Box>
    );
  }

  // セレクトボックス
  if (config.type === 'select') {
    const [customVoices, setCustomVoices] = useState<{ label: string; value: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const isVoiceIdField = config.name.includes('elevenlabs_voiceId');

    useEffect(() => {
      // ElevenLabsの音声IDフィールドの場合、カスタム音声を読み込む
      if (isVoiceIdField) {
        const loadCustomVoices = async () => {
          setLoading(true);
          try {
            const response = await fetch('/api/character-sheets');
            const data = await response.json();
            if (data.success) {
              const voices = data.characterSheets
                .filter((c: any) => c.elevenlabs_voice_id && c.elevenlabs_voice_id.trim())
                .map((c: any) => ({
                  label: `${c.name} (カスタム)`,
                  value: c.elevenlabs_voice_id,
                }));
              setCustomVoices(voices);
            }
          } catch (error) {
            console.error('Failed to load custom voices:', error);
          } finally {
            setLoading(false);
          }
        };
        loadCustomVoices();
      }
    }, [isVoiceIdField]);

    const allOptions = isVoiceIdField
      ? [...(config.options || []), ...customVoices]
      : (config.options || []);

    return (
      <Box>
        <TextField
          label={config.label}
          fullWidth
          select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          helperText={config.helperText}
          variant="outlined"
          disabled={loading}
        >
          {allOptions.map((option, index) => (
            <MenuItem key={`${option.value}-${index}`} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    );
  }

  // 画像アップロード（単一）
  if (config.type === 'image') {
    return (
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {config.label}
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
            startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{
              py: 1.5,
              borderStyle: 'dashed',
              borderWidth: 2,
            }}
          >
            {uploading ? 'アップロード中...' : '画像を選択'}
          </Button>
        )}

        {value && (
          <Paper variant="outlined" sx={{ p: 1, position: 'relative' }}>
            <IconButton
              size="small"
              onClick={() => handleRemoveImage(0)}
              disabled={uploading}
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
              src={`/api/storage/${value}`}
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
          startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= maxImages || uploading}
          sx={{
            py: 1.5,
            borderStyle: 'dashed',
            borderWidth: 2,
          }}
        >
          {uploading ? 'アップロード中...' : `画像を追加 (${images.length}/${maxImages})`}
        </Button>

        {images.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {images.map((imagePath: string, index: number) => (
              <Box key={index} sx={{ width: 'calc(50% - 8px)', position: 'relative' }}>
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveImage(index)}
                    disabled={uploading}
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
                    src={`/api/storage/${imagePath}`}
                    alt={`Upload ${index + 1}`}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                </Paper>
              </Box>
            ))}
          </Box>
        )}

      </Box>
    );
  }

  // キャラクターシート選択
  if (config.type === 'characterSheet') {
    const [characterSheets, setCharacterSheets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadCharacterSheets = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/character-sheets');

          if (!response.ok) {
            console.error('Failed to load character sheets:', response.status, response.statusText);
            if (response.status === 401) {
              console.error('Unauthorized - user not logged in');
            }
            setLoading(false);
            return;
          }

          const data = await response.json();

          if (data.success) {
            setCharacterSheets(data.characterSheets);
          } else {
            console.error('Failed to load character sheets:', data.error);
          }
        } catch (error) {
          console.error('Failed to load character sheets:', error);
        } finally {
          setLoading(false);
        }
      };

      loadCharacterSheets();
    }, []);

    const getImageUrl = (imageUrl: string) => {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      return `/api/storage/${imageUrl}`;
    };

    return (
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {config.label}
        </Typography>
        {config.helperText && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {config.helperText}
          </Typography>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : characterSheets.length === 0 ? (
          <Alert severity="warning">
            キャラクターシートがありません。先にキャラクターシートを作成してください。
          </Alert>
        ) : (
          <RadioGroup
            value={value?.toString() || ''}
            onChange={(e) => onChange(parseInt(e.target.value))}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {characterSheets.map((sheet) => (
                <Card
                  key={sheet.id}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    border: value === sheet.id ? 2 : 1,
                    borderColor: value === sheet.id ? 'primary.main' : 'divider',
                    '&:hover': {
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => onChange(sheet.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                    <FormControlLabel
                      value={sheet.id.toString()}
                      control={<Radio />}
                      label=""
                      sx={{ m: 0, mr: 1 }}
                    />
                    <CardMedia
                      component="img"
                      image={getImageUrl(sheet.image_url)}
                      alt={sheet.name}
                      sx={{
                        width: 80,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 1,
                      }}
                    />
                    <CardContent sx={{ flex: 1, py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {sheet.name}
                      </Typography>
                      {sheet.description && (
                        <Typography variant="caption" color="text.secondary">
                          {sheet.description}
                        </Typography>
                      )}
                    </CardContent>
                  </Box>
                </Card>
              ))}
            </Box>
          </RadioGroup>
        )}

      </Box>
    );
  }

  // キャラクターシート複数選択
  if (config.type === 'characterSheets') {
    const [characterSheets, setCharacterSheets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const selectedIds: number[] = value || [];
    const maxSelections = config.maxSelections || 4;

    useEffect(() => {
      const loadCharacterSheets = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/character-sheets');

          if (!response.ok) {
            console.error('Failed to load character sheets:', response.status, response.statusText);
            if (response.status === 401) {
              console.error('Unauthorized - user not logged in');
            }
            setLoading(false);
            return;
          }

          const data = await response.json();

          if (data.success) {
            setCharacterSheets(data.characterSheets);
          } else {
            console.error('Failed to load character sheets:', data.error);
          }
        } catch (error) {
          console.error('Failed to load character sheets:', error);
        } finally {
          setLoading(false);
        }
      };

      loadCharacterSheets();
    }, []);

    const getImageUrl = (imageUrl: string) => {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      return `/api/storage/${imageUrl}`;
    };

    const handleToggle = (id: number) => {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((csId: number) => csId !== id));
      } else {
        if (selectedIds.length >= maxSelections) {
          alert(`最大${maxSelections}つまで選択できます`);
          return;
        }
        onChange([...selectedIds, id]);
      }
    };

    return (
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {config.label}
        </Typography>
        {config.helperText && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {config.helperText}
          </Typography>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : characterSheets.length === 0 ? (
          <Alert severity="warning">
            キャラクターシートがありません。先にキャラクターシートを作成してください。
          </Alert>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {characterSheets.map((sheet) => (
                <Card
                  key={sheet.id}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    border: selectedIds.includes(sheet.id) ? 2 : 1,
                    borderColor: selectedIds.includes(sheet.id) ? '#2196F3' : 'divider',
                    '&:hover': {
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => handleToggle(sheet.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                    <FormControlLabel
                      control={
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sheet.id)}
                          onChange={() => handleToggle(sheet.id)}
                          style={{ width: 20, height: 20, cursor: 'pointer' }}
                        />
                      }
                      label=""
                      sx={{ m: 0, mr: 1 }}
                    />
                    <CardMedia
                      component="img"
                      image={getImageUrl(sheet.image_url)}
                      alt={sheet.name}
                      sx={{
                        width: 80,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 1,
                      }}
                    />
                    <CardContent sx={{ flex: 1, py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {sheet.name}
                      </Typography>
                      {sheet.description && (
                        <Typography variant="caption" color="text.secondary">
                          {sheet.description}
                        </Typography>
                      )}
                    </CardContent>
                  </Box>
                </Card>
              ))}
            </Box>
            {selectedIds.length > 0 && (
              <Alert severity="success" sx={{ mt: 2, fontSize: '0.875rem' }}>
                {selectedIds.length} 個のキャラクターシートを選択中
              </Alert>
            )}
          </Box>
        )}

      </Box>
    );
  }

  // スライダー
  if (config.type === 'slider') {
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const step = config.step ?? 1;

    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {config.label}: {typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : min}
        </Typography>
        <Slider
          value={typeof value === 'number' ? value : min}
          onChange={(_, newValue) => onChange(newValue)}
          min={min}
          max={max}
          step={step}
          marks={[
            { value: min, label: min.toString() },
            { value: (min + max) / 2, label: ((min + max) / 2).toString() },
            { value: max, label: max.toString() },
          ]}
        />
        {config.helperText && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
            {config.helperText}
          </Typography>
        )}
      </Box>
    );
  }

  // スイッチ
  if (config.type === 'switch') {
    return (
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
          }
          label={
            <Box>
              <Typography variant="body2">{config.label}</Typography>
              {config.helperText && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {config.helperText}
                </Typography>
              )}
            </Box>
          }
        />
      </Box>
    );
  }

  // タグ選択（ElevenLabsタグ）
  if (config.type === 'tags') {
    const [tags, setTags] = useState<any[]>([]);
    const [filteredTags, setFilteredTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
      const loadTags = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/eleven-labs-tags');
          const data = await response.json();

          if (data.success) {
            setTags(data.tags);
            setFilteredTags(data.tags);
          } else {
            console.error('Failed to load tags:', data.error);
          }
        } catch (error) {
          console.error('Failed to load tags:', error);
        } finally {
          setLoading(false);
        }
      };

      loadTags();
    }, []);

    useEffect(() => {
      if (searchQuery.trim() === '') {
        setFilteredTags(tags);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = tags.filter((tag) =>
          tag.name.toLowerCase().includes(query) ||
          tag.name_ja?.toLowerCase().includes(query) ||
          tag.description?.toLowerCase().includes(query) ||
          tag.description_ja?.toLowerCase().includes(query)
        );
        setFilteredTags(filtered);
      }
    }, [searchQuery, tags]);

    const handleInsertTag = (tagName: string) => {
      if (!config.targetFieldName || !onFieldChange || !allValues) {
        console.error('targetFieldName, onFieldChange, or allValues not provided', {
          targetFieldName: config.targetFieldName,
          hasOnFieldChange: !!onFieldChange,
          hasAllValues: !!allValues,
        });
        return;
      }

      // targetFieldNameに基づいて実際のフィールド名を探す
      // 例: targetFieldName='text' の場合、UnifiedNodeSettingsでは 'text'、formページでは 'elevenlabs_text_xxx'
      let actualFieldName = config.targetFieldName;

      // allValuesから対応するフィールド名を検索
      const fieldNames = Object.keys(allValues);
      console.log('Available field names:', fieldNames);
      console.log('Looking for field matching:', config.targetFieldName);

      // まず完全一致を試す
      if (fieldNames.includes(config.targetFieldName)) {
        actualFieldName = config.targetFieldName;
      } else {
        // 次に部分一致を探す（formページ用）
        const matchingField = fieldNames.find(name => name.includes(config.targetFieldName!));
        if (matchingField) {
          actualFieldName = matchingField;
        }
      }

      console.log('Inserting tag:', tagName, 'into field:', actualFieldName);
      console.log('Current text value:', allValues[actualFieldName]);

      const currentText = String(allValues[actualFieldName] || '');
      const newText = currentText + `[${tagName}]`;

      console.log('New text value:', newText);

      // 状態を更新
      onFieldChange(actualFieldName, newText);

      setDialogOpen(false);
      setSearchQuery('');
    };

    return (
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {config.label}
        </Typography>
        {config.helperText && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {config.helperText}
          </Typography>
        )}

        <Button
          variant="outlined"
          fullWidth
          onClick={() => setDialogOpen(true)}
          sx={{
            py: 1.5,
            textTransform: 'none',
            fontWeight: 500,
          }}
        >
          タグを選択して挿入
        </Button>

        {/* タグ選択ダイアログ */}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: dialogOpen ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
          }}
          onClick={() => setDialogOpen(false)}
        >
          <Paper
            sx={{
              width: '90%',
              maxWidth: 600,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ダイアログヘッダー */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  タグを選択
                </Typography>
                <IconButton size="small" onClick={() => setDialogOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* 検索フィールド */}
              <TextField
                fullWidth
                size="small"
                placeholder="タグを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                variant="outlined"
              />
            </Box>

            {/* タグリスト */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : filteredTags.length === 0 ? (
                <Alert severity="info">
                  {searchQuery ? '検索結果がありません' : 'タグがありません'}
                </Alert>
              ) : (
                <Stack spacing={1}>
                  {filteredTags.map((tag) => (
                    <Paper
                      key={tag.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderColor: 'primary.main',
                        },
                      }}
                      onClick={() => handleInsertTag(tag.name)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {tag.name_ja || tag.name}
                        </Typography>
                        <Chip
                          label={tag.name}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                            fontFamily: 'monospace',
                          }}
                        />
                      </Box>
                      {(tag.description_ja || tag.description) && (
                        <Typography variant="caption" color="text.secondary">
                          {tag.description_ja || tag.description}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  }

  return null;
}
