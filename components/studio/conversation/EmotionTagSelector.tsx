'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

interface EmotionTag {
  id: number;
  name: string;
  name_ja: string | null;
  description: string | null;
  description_ja: string | null;
}

interface EmotionTagSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectTag: (tagName: string) => void;
}

export default function EmotionTagSelector({
  open,
  onClose,
  onSelectTag,
}: EmotionTagSelectorProps) {
  const [tags, setTags] = useState<EmotionTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<EmotionTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

    if (open) {
      loadTags();
    }
  }, [open]);

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

  const handleSelectTag = (tagName: string) => {
    onSelectTag(tagName);
    onClose();
    setSearchQuery(''); // 検索クエリをリセット
  };

  const handleClose = () => {
    onClose();
    setSearchQuery(''); // 検索クエリをリセット
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">感情タグを選択</Typography>
          <Button
            onClick={handleClose}
            size="small"
            sx={{ minWidth: 'auto', p: 0.5 }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 検索バー */}
        <TextField
          fullWidth
          placeholder="タグを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ mb: 3 }}
          size="small"
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredTags.length === 0 ? (
          <Alert severity="info">
            {searchQuery ? '該当するタグが見つかりませんでした' : '感情タグがありません'}
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {filteredTags.map((tag) => (
              <Box
                key={tag.id}
                onClick={() => handleSelectTag(tag.name)}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                    boxShadow: 1,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={tag.name}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                  />
                  {tag.name_ja && (
                    <Typography variant="body2" fontWeight={600}>
                      {tag.name_ja}
                    </Typography>
                  )}
                </Box>
                {tag.description_ja && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {tag.description_ja}
                  </Typography>
                )}
                {tag.description && !tag.description_ja && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {tag.description}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="outlined">
          キャンセル
        </Button>
      </DialogActions>
    </Dialog>
  );
}
