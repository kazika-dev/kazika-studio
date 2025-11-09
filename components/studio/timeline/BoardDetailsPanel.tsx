'use client';

import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { TimelineBoard } from './boardTypes';

interface BoardDetailsPanelProps {
  board: TimelineBoard | null;
  onClose: () => void;
  onUpdate: (boardId: number, updates: Partial<TimelineBoard>) => void;
}

export default function BoardDetailsPanel({ board, onClose, onUpdate }: BoardDetailsPanelProps) {
  if (!board) {
    return (
      <Box
        sx={{
          width: 380,
          bgcolor: '#2d2d2d',
          borderLeft: '1px solid #424242',
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
          ボードを選択してください
        </Typography>
      </Box>
    );
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" sx={{ color: '#4caf50' }} />;
      case 'failed':
        return <ErrorIcon fontSize="small" sx={{ color: '#f44336' }} />;
      case 'running':
        return <PendingIcon fontSize="small" sx={{ color: '#2196f3' }} />;
      default:
        return <PendingIcon fontSize="small" sx={{ color: '#757575' }} />;
    }
  };

  return (
    <Box
      sx={{
        width: 380,
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
          シーン詳細
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
            タイトル
          </Typography>
          <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 2, fontWeight: 600 }}>
            {board.title || `シーン ${board.sequence_order + 1}`}
          </Typography>

          {board.description && (
            <>
              <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
                説明
              </Typography>
              <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 2 }}>
                {board.description}
              </Typography>
            </>
          )}

          <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
            ステータス
          </Typography>
          <Chip
            label={
              board.status === 'completed'
                ? '完了'
                : board.status === 'processing'
                ? '処理中'
                : board.status === 'error'
                ? 'エラー'
                : '下書き'
            }
            color={
              board.status === 'completed'
                ? 'success'
                : board.status === 'processing'
                ? 'info'
                : board.status === 'error'
                ? 'error'
                : 'default'
            }
            size="small"
            sx={{ mb: 2 }}
          />
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
                value={Number(board.timeline_start) || 0}
                onChange={(e) =>
                  onUpdate(board.id, { timeline_start: parseFloat(e.target.value) || 0 })
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
                value={Number(board.timeline_duration) || 1}
                onChange={(e) =>
                  onUpdate(board.id, {
                    timeline_duration: parseFloat(e.target.value) || 1,
                    duration_seconds: parseFloat(e.target.value) || 1,
                  })
                }
                slotProps={{
                  htmlInput: { min: 1, step: 0.5 },
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

        {/* WorkflowSteps */}
        <Accordion sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
            <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
              WorkflowSteps ({board.workflow_steps?.length || 0})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {board.workflow_steps && board.workflow_steps.length > 0 ? (
              <List dense>
                {board.workflow_steps
                  .sort((a, b) => a.step_order - b.step_order)
                  .map((step, index) => (
                    <ListItem
                      key={step.id}
                      sx={{
                        bgcolor: index === board.workflow_steps!.length - 1 ? '#1a237e22' : 'transparent',
                        borderRadius: 1,
                        mb: 0.5,
                        border:
                          index === board.workflow_steps!.length - 1
                            ? '1px solid #1a237e'
                            : 'none',
                      }}
                    >
                      <Box sx={{ mr: 1 }}>{getStepIcon(step.execution_status)}</Box>
                      <ListItemText
                        primary={
                          <Typography variant="body2" component="span" sx={{ color: '#e0e0e0' }}>
                            {step.workflow_name || `Step ${step.step_order + 1}`}
                            {index === board.workflow_steps!.length - 1 && (
                              <Chip
                                label="最終出力"
                                size="small"
                                sx={{
                                  ml: 1,
                                  height: 18,
                                  fontSize: '0.65rem',
                                  bgcolor: '#1a237e',
                                  color: 'white',
                                }}
                              />
                            )}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                            {step.execution_status === 'completed'
                              ? '完了'
                              : step.execution_status === 'running'
                              ? '実行中'
                              : step.execution_status === 'failed'
                              ? '失敗'
                              : '待機中'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            ) : (
              <Typography variant="body2" sx={{ color: '#9e9e9e', textAlign: 'center', py: 2 }}>
                WorkflowStepsがありません
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* トランジション */}
        <Accordion sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
            <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
              次のシーンへのトランジション
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* トランジションタイプ */}
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#9e9e9e' }}>トランジション</InputLabel>
                <Select
                  value={board.transition_to_next?.type || 'none'}
                  onChange={(e) =>
                    onUpdate(board.id, {
                      transition_to_next: {
                        type: e.target.value as any,
                        duration: board.transition_to_next?.duration || 1,
                      },
                    })
                  }
                  label="トランジション"
                  sx={{
                    color: '#e0e0e0',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                  }}
                >
                  <MenuItem value="none">なし</MenuItem>
                  <MenuItem value="fade">フェード</MenuItem>
                  <MenuItem value="slide">スライド</MenuItem>
                  <MenuItem value="wipe">ワイプ</MenuItem>
                  <MenuItem value="dissolve">ディゾルブ</MenuItem>
                </Select>
              </FormControl>

              {/* トランジション長さ */}
              {board.transition_to_next?.type !== 'none' && (
                <TextField
                  label="トランジション長さ（秒）"
                  type="number"
                  size="small"
                  value={board.transition_to_next?.duration || 1}
                  onChange={(e) =>
                    onUpdate(board.id, {
                      transition_to_next: {
                        type: board.transition_to_next?.type || 'fade',
                        duration: parseFloat(e.target.value) || 1,
                      },
                    })
                  }
                  slotProps={{
                    htmlInput: { min: 0.1, max: 5, step: 0.1 },
                  }}
                  sx={{
                    '& .MuiInputLabel-root': { color: '#9e9e9e' },
                    '& .MuiInputBase-input': { color: '#e0e0e0' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                  }}
                />
              )}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* フィルター */}
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#9e9e9e' }}>フィルター</InputLabel>
                <Select
                  value={board.effects?.filter || 'none'}
                  onChange={(e) =>
                    onUpdate(board.id, {
                      effects: { ...board.effects, filter: e.target.value as any },
                    })
                  }
                  label="フィルター"
                  sx={{
                    color: '#e0e0e0',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#424242' },
                  }}
                >
                  <MenuItem value="none">なし</MenuItem>
                  <MenuItem value="grayscale">グレースケール</MenuItem>
                  <MenuItem value="sepia">セピア</MenuItem>
                  <MenuItem value="blur">ブラー</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* プロンプト */}
        {board.prompt_text && (
          <Accordion sx={{ bgcolor: '#252525', boxShadow: 'none' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#9e9e9e' }} />}>
              <Typography variant="subtitle2" sx={{ color: '#e0e0e0' }}>
                プロンプト
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography
                variant="body2"
                sx={{ color: '#e0e0e0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {board.prompt_text}
              </Typography>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
}
