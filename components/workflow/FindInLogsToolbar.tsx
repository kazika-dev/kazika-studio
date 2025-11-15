'use client';

import { Box, Paper, TextField, IconButton, Typography, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface FindInLogsToolbarProps {
  isOpen: boolean;
  searchQuery: string;
  currentMatchIndex: number;
  totalMatches: number;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

/**
 * ログ内検索用のツールバーコンポーネント
 * Ctrl+F で表示され、ログ内のテキスト検索機能を提供
 */
export default function FindInLogsToolbar({
  isOpen,
  searchQuery,
  currentMatchIndex,
  totalMatches,
  onSearchChange,
  onClose,
  onNext,
  onPrevious,
}: FindInLogsToolbarProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Fade in={isOpen}>
      <Paper
        elevation={4}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1000,
          p: 1,
          display: isOpen ? 'flex' : 'none',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          borderRadius: 1,
          minWidth: 320,
        }}
      >
        <TextField
          size="small"
          placeholder="ログ内を検索..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
            },
          }}
        />

        {totalMatches > 0 && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              minWidth: 60,
              textAlign: 'center',
            }}
          >
            {currentMatchIndex + 1} / {totalMatches}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={onPrevious}
            disabled={totalMatches === 0}
            title="前へ (Shift+Enter)"
            sx={{ p: 0.5 }}
          >
            <KeyboardArrowUpIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={onNext}
            disabled={totalMatches === 0}
            title="次へ (Enter)"
            sx={{ p: 0.5 }}
          >
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={onClose}
            title="閉じる (Esc)"
            sx={{ p: 0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Paper>
    </Fade>
  );
}
