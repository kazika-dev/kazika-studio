'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';

interface CharacterSheetSummary {
  id: number;
  name: string;
  image_url: string | null;
}

interface MessageCharacterWithDetails {
  id: number;
  conversation_message_id: number;
  character_sheet_id: number;
  display_order: number;
  created_at: string;
  metadata: Record<string, any>;
  character_sheets: {
    id: number;
    name: string;
    image_url: string | null;
    description: string | null;
    personality: string | null;
    speaking_style: string | null;
  };
}

interface MessageCharacterSelectorProps {
  messageId: number;
  availableCharacters: CharacterSheetSummary[];
  onUpdate?: () => void;
}

export default function MessageCharacterSelector({
  messageId,
  availableCharacters,
  onUpdate
}: MessageCharacterSelectorProps) {
  const [characters, setCharacters] = useState<MessageCharacterWithDetails[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, [messageId]);

  const loadCharacters = async () => {
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}/characters`);
      const result = await response.json();
      if (result.success) {
        setCharacters(result.data.characters || []);
      }
    } catch (error) {
      console.error('[MessageCharacterSelector] Failed to load message characters:', error);
    }
  };

  const handleAddCharacter = async (characterId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId })
      });

      if (response.ok) {
        console.log(`[MessageCharacterSelector] Added character ${characterId} to message ${messageId}`);
        await loadCharacters();
        setDialogOpen(false);
        onUpdate?.();
      } else {
        const error = await response.json();
        console.error('[MessageCharacterSelector] Failed to add character:', error);
      }
    } catch (error) {
      console.error('[MessageCharacterSelector] Failed to add character:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCharacter = async (characterId: number) => {
    try {
      const response = await fetch(
        `/api/conversations/messages/${messageId}/characters?characterId=${characterId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        console.log(`[MessageCharacterSelector] Removed character ${characterId} from message ${messageId}`);
        await loadCharacters();
        onUpdate?.();
      } else {
        const error = await response.json();
        console.error('[MessageCharacterSelector] Failed to remove character:', error);
      }
    } catch (error) {
      console.error('[MessageCharacterSelector] Failed to remove character:', error);
    }
  };

  const selectedIds = characters.map(c => c.character_sheet_id);
  const availableToAdd = availableCharacters.filter(c => !selectedIds.includes(c.id));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          登場キャラクター
        </Typography>
        {characters.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            ({characters.length}人)
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {characters.length === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            登場キャラクターなし
          </Typography>
        )}

        {characters.map(char => (
          <Box key={char.id} sx={{ position: 'relative' }}>
            <Tooltip title={char.character_sheets?.name || ''}>
              <Avatar
                src={char.character_sheets?.image_url || undefined}
                alt={char.character_sheets?.name}
                sx={{ width: 40, height: 40, border: '2px solid', borderColor: 'primary.main' }}
              />
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => handleRemoveCharacter(char.character_sheet_id)}
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                bgcolor: 'error.main',
                color: 'white',
                width: 20,
                height: 20,
                '&:hover': { bgcolor: 'error.dark' }
              }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}

        <Tooltip title="キャラクターを追加">
          <span>
            <IconButton
              onClick={() => setDialogOpen(true)}
              disabled={availableToAdd.length === 0 || characters.length >= 4}
              sx={{
                border: '2px dashed',
                borderColor: availableToAdd.length === 0 || characters.length >= 4 ? 'action.disabled' : 'primary.main',
                borderRadius: '50%',
                width: 40,
                height: 40,
                color: availableToAdd.length === 0 || characters.length >= 4 ? 'action.disabled' : 'primary.main'
              }}
            >
              <PersonAddIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>シーンキャラクターを追加</DialogTitle>
        <DialogContent>
          {availableToAdd.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              追加できるキャラクターがありません
            </Typography>
          ) : (
            <List>
              {availableToAdd.map(char => (
                <ListItem key={char.id} disablePadding sx={{ py: 1 }}>
                  <ListItemAvatar>
                    <Avatar src={char.image_url || undefined} alt={char.name} />
                  </ListItemAvatar>
                  <ListItemText primary={char.name} />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleAddCharacter(char.id)}
                      disabled={loading}
                    >
                      追加
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
