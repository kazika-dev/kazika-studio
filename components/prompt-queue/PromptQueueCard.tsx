'use client';

import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { PromptQueueWithImages } from '@/types/prompt-queue';

interface PromptQueueCardProps {
  queue: PromptQueueWithImages;
  onEdit: (queue: PromptQueueWithImages) => void;
  onDelete: (queue: PromptQueueWithImages) => void;
  onExecute: (queue: PromptQueueWithImages) => void;
  isExecuting?: boolean;
}

const statusConfig = {
  pending: { label: '待機中', color: 'default' as const, icon: PendingIcon },
  processing: { label: '処理中', color: 'info' as const, icon: CircularProgress },
  completed: { label: '完了', color: 'success' as const, icon: CheckCircleIcon },
  failed: { label: '失敗', color: 'error' as const, icon: ErrorIcon },
  cancelled: { label: 'キャンセル', color: 'warning' as const, icon: CancelIcon },
};

/**
 * 画像URLを取得（GCP Storageパスの場合はAPIエンドポイント経由）
 */
function getImageUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `/api/storage/${url}`;
}

export default function PromptQueueCard({
  queue,
  onEdit,
  onDelete,
  onExecute,
  isExecuting = false,
}: PromptQueueCardProps) {
  const status = statusConfig[queue.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {queue.name || `キュー #${queue.id}`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Chip
                size="small"
                label={status.label}
                color={status.color}
                icon={queue.status === 'processing' ? <CircularProgress size={14} /> : <StatusIcon sx={{ fontSize: 16 }} />}
              />
              <Chip size="small" label={`優先度: ${queue.priority}`} variant="outlined" />
              <Chip size="small" label={queue.aspect_ratio} variant="outlined" />
            </Box>
          </Box>
          <Box>
            {queue.status === 'pending' && (
              <Tooltip title="実行">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onExecute(queue)}
                  disabled={isExecuting}
                >
                  {isExecuting ? <CircularProgress size={20} /> : <PlayIcon />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="編集">
              <IconButton size="small" onClick={() => onEdit(queue)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="削除">
              <IconButton size="small" color="error" onClick={() => onDelete(queue)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* プロンプト */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {queue.prompt}
        </Typography>

        {/* 参照画像 */}
        {queue.images.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {queue.images.slice(0, 8).map((img) => {
              const imageUrl = getImageUrl(img.image_url);

              return (
                <Tooltip
                  key={img.id}
                  title={img.name || (img.image_type === 'character_sheet' ? 'キャラクターシート' : 'アウトプット')}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: img.image_type === 'character_sheet' ? '2px solid #1976d2' : '2px solid #9c27b0',
                    }}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={img.name || '参照画像'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <ImageIcon sx={{ color: 'grey.400' }} />
                    )}
                  </Box>
                </Tooltip>
              );
            })}
            {queue.image_count > 8 && (
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  bgcolor: 'grey.300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption">+{queue.image_count - 8}</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* エラーメッセージ */}
        {queue.status === 'failed' && queue.error_message && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            エラー: {queue.error_message}
          </Typography>
        )}

        {/* 日時 */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          作成: {new Date(queue.created_at).toLocaleString('ja-JP')}
          {queue.executed_at && ` | 実行: ${new Date(queue.executed_at).toLocaleString('ja-JP')}`}
        </Typography>
      </CardContent>
    </Card>
  );
}
