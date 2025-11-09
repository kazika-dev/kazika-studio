'use client';

import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import { TimelineStep } from './types';

interface StepDetailsPanelProps {
  step: TimelineStep | null;
  onClose: () => void;
  onUpdate: (stepId: number, updates: Partial<TimelineStep>) => void;
}

export default function StepDetailsPanel({ step, onClose, onUpdate }: StepDetailsPanelProps) {
  if (!step) {
    return (
      <Box
        sx={{
          width: 350,
          bgcolor: '#2d2d2d',
          borderLeft: '1px solid #424242',
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
          ステップを選択してください
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 350,
        bgcolor: '#2d2d2d',
        borderLeft: '1px solid #424242',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid #424242',
        }}
      >
        <Typography variant="subtitle1" sx={{ color: '#e0e0e0', fontWeight: 600 }}>
          ステップ詳細
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#9e9e9e' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* コンテンツ */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* 基本情報 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
            ワークフロー名
          </Typography>
          <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 2 }}>
            {step.workflow_name || `ステップ ${step.step_order + 1}`}
          </Typography>

          {step.workflow_description && (
            <>
              <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
                説明
              </Typography>
              <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 2 }}>
                {step.workflow_description}
              </Typography>
            </>
          )}
        </Box>

        <Divider sx={{ bgcolor: '#424242', mb: 3 }} />

        {/* タイムライン設定 */}
        <Accordion defaultExpanded sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
            <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
              タイムライン設定
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 開始時間 */}
              <TextField
                label="開始時間（秒）"
                type="number"
                size="small"
                value={step.timeline_start}
                onChange={(e) =>
                  onUpdate(step.id, { timeline_start: parseFloat(e.target.value) || 0 })
                }
                slotProps={{
                  htmlInput: { min: 0, step: 0.1 },
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#9e9e9e' },
                  '& .MuiInputBase-input': { color: '#e0e0e0' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                }}
              />

              {/* 長さ */}
              <TextField
                label="長さ（秒）"
                type="number"
                size="small"
                value={step.timeline_duration}
                onChange={(e) =>
                  onUpdate(step.id, { timeline_duration: parseFloat(e.target.value) || 0.1 })
                }
                slotProps={{
                  htmlInput: { min: 0.1, step: 0.1 },
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#9e9e9e' },
                  '& .MuiInputBase-input': { color: '#e0e0e0' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                }}
              />

              {/* レイヤー */}
              <TextField
                label="レイヤー"
                type="number"
                size="small"
                value={step.timeline_layer}
                onChange={(e) =>
                  onUpdate(step.id, { timeline_layer: parseInt(e.target.value) || 0 })
                }
                slotProps={{
                  htmlInput: { min: 0, step: 1 },
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#9e9e9e' },
                  '& .MuiInputBase-input': { color: '#e0e0e0' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* エフェクト */}
        <Accordion sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
            <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
              エフェクト
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 不透明度 */}
              <Box>
                <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
                  不透明度: {((step.effects?.opacity ?? 1) * 100).toFixed(0)}%
                </Typography>
                <Slider
                  value={(step.effects?.opacity ?? 1) * 100}
                  onChange={(_, value) =>
                    onUpdate(step.id, {
                      effects: { ...step.effects, opacity: (value as number) / 100 },
                    })
                  }
                  min={0}
                  max={100}
                  size="small"
                  sx={{ color: '#1976d2' }}
                />
              </Box>

              {/* スケール */}
              <Box>
                <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
                  スケール: {((step.effects?.scale ?? 1) * 100).toFixed(0)}%
                </Typography>
                <Slider
                  value={(step.effects?.scale ?? 1) * 100}
                  onChange={(_, value) =>
                    onUpdate(step.id, {
                      effects: { ...step.effects, scale: (value as number) / 100 },
                    })
                  }
                  min={10}
                  max={200}
                  size="small"
                  sx={{ color: '#1976d2' }}
                />
              </Box>

              {/* 位置 X */}
              <TextField
                label="位置 X"
                type="number"
                size="small"
                value={step.effects?.position?.x ?? 0}
                onChange={(e) =>
                  onUpdate(step.id, {
                    effects: {
                      ...step.effects,
                      position: { x: parseFloat(e.target.value) || 0, y: step.effects?.position?.y ?? 0 },
                    },
                  })
                }
                sx={{
                  '& .MuiInputLabel-root': { color: '#9e9e9e' },
                  '& .MuiInputBase-input': { color: '#e0e0e0' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                }}
              />

              {/* 位置 Y */}
              <TextField
                label="位置 Y"
                type="number"
                size="small"
                value={step.effects?.position?.y ?? 0}
                onChange={(e) =>
                  onUpdate(step.id, {
                    effects: {
                      ...step.effects,
                      position: { x: step.effects?.position?.x ?? 0, y: parseFloat(e.target.value) || 0 },
                    },
                  })
                }
                sx={{
                  '& .MuiInputLabel-root': { color: '#9e9e9e' },
                  '& .MuiInputBase-input': { color: '#e0e0e0' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* トランジション */}
        <Accordion sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
            <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
              トランジション
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* フェードイン */}
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#9e9e9e' }}>フェードイン</InputLabel>
                <Select
                  value={step.transition_in?.type ?? 'none'}
                  onChange={(e) =>
                    onUpdate(step.id, {
                      transition_in: {
                        type: e.target.value as any,
                        duration: step.transition_in?.duration ?? 0.5,
                      },
                    })
                  }
                  label="フェードイン"
                  sx={{
                    color: '#e0e0e0',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                  }}
                >
                  <MenuItem value="none">なし</MenuItem>
                  <MenuItem value="fade">フェード</MenuItem>
                  <MenuItem value="slide">スライド</MenuItem>
                  <MenuItem value="zoom">ズーム</MenuItem>
                </Select>
              </FormControl>

              {/* フェードアウト */}
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#9e9e9e' }}>フェードアウト</InputLabel>
                <Select
                  value={step.transition_out?.type ?? 'none'}
                  onChange={(e) =>
                    onUpdate(step.id, {
                      transition_out: {
                        type: e.target.value as any,
                        duration: step.transition_out?.duration ?? 0.5,
                      },
                    })
                  }
                  label="フェードアウト"
                  sx={{
                    color: '#e0e0e0',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                  }}
                >
                  <MenuItem value="none">なし</MenuItem>
                  <MenuItem value="fade">フェード</MenuItem>
                  <MenuItem value="slide">スライド</MenuItem>
                  <MenuItem value="zoom">ズーム</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 出力プレビュー */}
        {step.output_data && (
          <Accordion sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
              <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
                出力プレビュー
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {step.output_data.imageUrl && (
                <Box
                  component="img"
                  src={step.output_data.imageUrl}
                  alt="出力画像"
                  sx={{ width: '100%', borderRadius: 1 }}
                />
              )}
              {step.output_data.response && (
                <Typography variant="body2" sx={{ color: '#e0e0e0', whiteSpace: 'pre-wrap' }}>
                  {step.output_data.response}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
}
