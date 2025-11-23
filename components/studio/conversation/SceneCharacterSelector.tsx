'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { StorySceneCharacterWithDetails } from '@/types/conversation';

interface Character {
  id: number;
  name: string;
  image_url: string | null;
  description: string | null;
}

interface SceneCharacterSelectorProps {
  sceneId: number;
  onUpdate?: () => void;
}

export default function SceneCharacterSelector({
  sceneId,
  onUpdate
}: SceneCharacterSelectorProps) {
  const [sceneCharacters, setSceneCharacters] = useState<StorySceneCharacterWithDetails[]>([]);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCharacters, setLoadingCharacters] = useState(false);

  useEffect(() => {
    if (sceneId) {
      loadSceneCharacters();
      loadAllCharacters();
    }
  }, [sceneId]);

  const loadSceneCharacters = async () => {
    try {
      const response = await fetch(`/api/scenes/${sceneId}/characters`);
      const result = await response.json();

      if (result.success && result.data) {
        setSceneCharacters(result.data.characters || []);
      } else {
        setError(result.error || 'キャラクターの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load scene characters:', error);
      setError('キャラクターの読み込みに失敗しました');
    }
  };

  const loadAllCharacters = async () => {
    setLoadingCharacters(true);
    try {
      const response = await fetch('/api/characters');
      const result = await response.json();

      if (result.success && result.data) {
        setAllCharacters(result.data.characters || []);
      }
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setLoadingCharacters(false);
    }
  };

  const handleAddCharacter = async (characterId: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scenes/${sceneId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId })
      });

      const result = await response.json();

      if (result.success) {
        await loadSceneCharacters();
        onUpdate?.();
        setDialogOpen(false);
      } else {
        setError(result.error || 'キャラクターの追加に失敗しました');
      }
    } catch (error) {
      console.error('Failed to add character:', error);
      setError('キャラクターの追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCharacter = async (characterId: number) => {
    if (!confirm('このキャラクターをシーンから削除しますか？')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/scenes/${sceneId}/characters?characterId=${characterId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (result.success) {
        await loadSceneCharacters();
        onUpdate?.();
      } else {
        setError(result.error || 'キャラクターの削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to remove character:', error);
      setError('キャラクターの削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMainCharacter = async (characterId: number, isCurrentlyMain: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scenes/${sceneId}/characters`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          isMainCharacter: !isCurrentlyMain
        })
      });

      const result = await response.json();

      if (result.success) {
        await loadSceneCharacters();
        onUpdate?.();
      } else {
        setError(result.error || 'メインキャラクターの更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to toggle main character:', error);
      setError('メインキャラクターの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const availableCharacters = allCharacters.filter(
    char => !sceneCharacters.some(sc => sc.character_sheet_id === char.id)
  );

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Typography variant="h6">登場キャラクター</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          size="small"
          onClick={() => setDialogOpen(true)}
          disabled={loading}
        >
          追加
        </Button>
        {sceneCharacters.length > 0 && (
          <Chip
            label={`${sceneCharacters.length}人`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      {/* 登録済みキャラクター一覧 */}
      {sceneCharacters.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          まだキャラクターが登録されていません。「追加」ボタンからキャラクターを選択してください。
        </Typography>
      ) : (
        <List>
          {sceneCharacters.map((char) => (
            <ListItem
              key={char.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1
              }}
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleMainCharacter(char.character_sheet_id, char.is_main_character)}
                    disabled={loading}
                    title={char.is_main_character ? 'メインキャラクターを解除' : 'メインキャラクターに設定'}
                  >
                    {char.is_main_character ? (
                      <StarIcon color="warning" />
                    ) : (
                      <StarBorderIcon />
                    )}
                  </IconButton>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleRemoveCharacter(char.character_sheet_id)}
                    disabled={loading}
                    title="削除"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              }
            >
              <DragIndicatorIcon
                sx={{ mr: 1, cursor: 'grab', color: 'text.disabled' }}
                fontSize="small"
              />
              <ListItemAvatar>
                <Avatar
                  src={char.image_url || undefined}
                  alt={char.character_name}
                />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1">{char.character_name}</Typography>
                    {char.is_main_character && (
                      <Chip label="メイン" size="small" color="warning" />
                    )}
                  </Stack>
                }
                secondary={char.description}
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* キャラクター追加ダイアログ */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>キャラクターを追加</DialogTitle>
        <DialogContent>
          {loadingCharacters ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : availableCharacters.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              追加できるキャラクターがありません。
            </Typography>
          ) : (
            <List>
              {availableCharacters.map((char) => (
                <ListItem
                  key={char.id}
                  button
                  onClick={() => handleAddCharacter(char.id)}
                  disabled={loading}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={char.image_url || undefined}
                      alt={char.name}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={char.name}
                    secondary={char.description}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            キャンセル
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
