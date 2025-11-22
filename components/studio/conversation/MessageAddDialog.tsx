'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  Typography
} from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import EmotionTagSelector from './EmotionTagSelector';

interface Character {
  id: number;
  name: string;
  image_url?: string;
}

interface InsertAfterMessage {
  id: number;
  speaker_name: string;
  message_text: string;
}

interface MessageAddDialogProps {
  open: boolean;
  characters: Character[];
  insertAfterMessage?: InsertAfterMessage | null;
  onClose: () => void;
  onAdd: (characterId: number, messageText: string, emotionTag?: string) => Promise<void>;
}

export default function MessageAddDialog({
  open,
  characters,
  insertAfterMessage,
  onClose,
  onAdd
}: MessageAddDialogProps) {
  const [characterId, setCharacterId] = useState<number | ''>('');
  const [messageText, setMessageText] = useState('');
  const [emotionTag, setEmotionTag] = useState<string | undefined>(undefined);
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = () => {
    if (saving) return;
    setCharacterId('');
    setMessageText('');
    setEmotionTag(undefined);
    onClose();
  };

  const handleAdd = async () => {
    if (!characterId || !messageText.trim()) {
      return;
    }

    setSaving(true);
    try {
      await onAdd(characterId as number, messageText.trim(), emotionTag);
      handleClose();
    } catch (error) {
      console.error('Failed to add message:', error);
      alert('メッセージの追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTagSelector = () => {
    setTagSelectorOpen(true);
  };

  const handleSelectTag = (tagName: string) => {
    setEmotionTag(tagName);
    setTagSelectorOpen(false);
  };

  const handleRemoveTag = () => {
    setEmotionTag(undefined);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {insertAfterMessage ? 'メッセージの後に追加' : '新しいメッセージを追加'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Insert Position Info */}
            {insertAfterMessage && (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: 'action.hover',
                  borderRadius: 1,
                  borderLeft: '3px solid',
                  borderColor: 'primary.main'
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  このメッセージの後に追加されます:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {insertAfterMessage.speaker_name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {insertAfterMessage.message_text}
                </Typography>
              </Box>
            )}

            {/* Character Selection */}
            <FormControl fullWidth>
              <InputLabel>キャラクター</InputLabel>
              <Select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value as number)}
                label="キャラクター"
                disabled={saving}
              >
                {characters.map((char) => (
                  <MenuItem key={char.id} value={char.id}>
                    {char.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Emotion Tag Section */}
            <Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LocalOfferIcon />}
                  onClick={handleOpenTagSelector}
                  disabled={saving}
                  sx={{ fontSize: '0.75rem', py: 0.5 }}
                >
                  感情タグを追加
                </Button>
                {emotionTag && (
                  <Chip
                    label={emotionTag}
                    size="small"
                    onDelete={handleRemoveTag}
                    color="primary"
                  />
                )}
              </Box>
              {emotionTag && (
                <Typography variant="caption" color="text.secondary">
                  メッセージに [{emotionTag}] が自動的に追加されます
                </Typography>
              )}
            </Box>

            {/* Message Text */}
            <TextField
              fullWidth
              multiline
              rows={4}
              label="メッセージ"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={saving}
              placeholder="メッセージを入力してください"
              inputRef={textFieldRef}
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            キャンセル
          </Button>
          <Button
            onClick={handleAdd}
            variant="contained"
            disabled={saving || !characterId || !messageText.trim()}
          >
            {saving ? '追加中...' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Emotion Tag Selector Dialog */}
      <EmotionTagSelector
        open={tagSelectorOpen}
        onClose={() => setTagSelectorOpen(false)}
        onSelectTag={handleSelectTag}
      />
    </>
  );
}
