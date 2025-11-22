'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Avatar,
  Typography,
  IconButton,
  TextField,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AddIcon from '@mui/icons-material/Add';
import type { ConversationMessageWithCharacter } from '@/types/conversation';
import EmotionTagSelector from './EmotionTagSelector';
import MessageAddDialog from './MessageAddDialog';
import MessageCharacterSelector from './MessageCharacterSelector';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Character {
  id: number;
  name: string;
  image_url?: string;
}

interface ConversationViewerProps {
  messages: ConversationMessageWithCharacter[];
  characters?: Character[];
  onUpdateMessage?: (messageId: number, updates: { messageText?: string; characterId?: number }) => Promise<void>;
  onReorderMessages?: (messages: ConversationMessageWithCharacter[]) => Promise<void>;
  onDeleteMessage?: (messageId: number) => Promise<void>;
  onReanalyzeEmotion?: (messageId: number) => Promise<void>;
  onAddMessage?: (characterId: number, messageText: string, emotionTag?: string, insertAfterMessageId?: number) => Promise<void>;
  readonly?: boolean;
}

interface SortableMessageProps {
  message: ConversationMessageWithCharacter;
  isEditing: boolean;
  editText: string;
  editCharacterId: number | null;
  characters?: Character[];
  saving: boolean;
  reanalyzing: boolean;
  readonly?: boolean;
  showInsertButton?: boolean;
  onEditClick: (message: ConversationMessageWithCharacter) => void;
  onSave: (messageId: number) => void;
  onCancel: () => void;
  onDelete: (messageId: number) => void;
  onReanalyzeEmotion: (messageId: number) => void;
  onTextChange: (text: string) => void;
  onCharacterChange: (characterId: number) => void;
  onOpenTagSelector: () => void;
  onInsertAfter?: (messageId: number) => void;
  textFieldRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function SortableMessage({
  message,
  isEditing,
  editText,
  editCharacterId,
  characters,
  saving,
  reanalyzing,
  readonly,
  showInsertButton,
  onEditClick,
  onSave,
  onCancel,
  onDelete,
  onReanalyzeEmotion,
  onTextChange,
  onCharacterChange,
  onOpenTagSelector,
  onInsertAfter,
  textFieldRef
}: SortableMessageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: message.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const emotionColors: Record<string, string> = {
    happy: '#4caf50',
    sad: '#2196f3',
    angry: '#f44336',
    neutral: '#9e9e9e',
    surprised: '#ff9800',
    excited: '#ff5722',
    confused: '#9c27b0'
  };

  const emotionLabels: Record<string, string> = {
    happy: '喜び',
    sad: '悲しみ',
    angry: '怒り',
    neutral: '平常',
    surprised: '驚き',
    excited: '興奮',
    confused: '困惑'
  };

  return (
    <>
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 4 : 1}
      sx={{
        padding: 2,
        marginBottom: 2,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 3,
          '& .drag-handle': {
            opacity: 1
          }
        }
      }}
    >
      {/* Drag Handle */}
      {!readonly && (
        <Box
          className="drag-handle"
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            opacity: 0.3,
            transition: 'opacity 0.2s',
            display: 'flex',
            alignItems: 'center',
            '&:active': {
              cursor: 'grabbing'
            }
          }}
        >
          <DragIndicatorIcon />
        </Box>
      )}

      {/* Character Avatar */}
      <Avatar
        src={message.character?.image_url || undefined}
        alt={message.speaker_name}
        sx={{
          width: 56,
          height: 56,
          border: '2px solid',
          borderColor: 'primary.main'
        }}
      >
        {message.speaker_name.charAt(0)}
      </Avatar>

      {/* Message Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            marginBottom: 1,
            flexWrap: 'wrap'
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            {message.speaker_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            #{message.sequence_order + 1}
          </Typography>
          {message.metadata?.emotion && (
            <Chip
              label={emotionLabels[message.metadata.emotion] || message.metadata.emotion}
              size="small"
              sx={{
                backgroundColor: emotionColors[message.metadata.emotion] || '#9e9e9e',
                color: 'white',
                fontSize: '0.7rem',
                height: 20
              }}
            />
          )}
        </Box>

        {/* Character Selection (when editing) */}
        {isEditing && characters && characters.length > 0 && (
          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>キャラクター</InputLabel>
            <Select
              value={editCharacterId || ''}
              onChange={(e) => onCharacterChange(e.target.value as number)}
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
        )}

        {/* Message Text */}
        {isEditing ? (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Tooltip title="感情タグを追加">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LocalOfferIcon />}
                  onClick={onOpenTagSelector}
                  disabled={saving}
                  sx={{ fontSize: '0.75rem', py: 0.5 }}
                >
                  感情タグを追加
                </Button>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={editText}
              onChange={(e) => onTextChange(e.target.value)}
              disabled={saving}
              autoFocus
              inputRef={textFieldRef}
            />
          </Box>
        ) : (
          <>
            <Typography
              variant="body1"
              onClick={() => !readonly && onEditClick(message)}
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                cursor: !readonly ? 'pointer' : 'default',
                padding: 1,
                borderRadius: 1,
                transition: 'background-color 0.2s',
                '&:hover': !readonly ? {
                  backgroundColor: 'action.hover'
                } : {}
              }}
            >
              {message.message_text}
            </Typography>
            {/* Scene Prompts */}
            {(message.scene_prompt_ja || message.scene_prompt_en) && (
              <Box sx={{ mt: 2 }}>
                {message.scene_prompt_ja && (
                  <Typography
                    variant="body2"
                    sx={{
                      mb: 1,
                      padding: 1,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      borderLeft: '3px solid #2196f3'
                    }}
                  >
                    <strong>日本語プロンプト:</strong> {message.scene_prompt_ja}
                  </Typography>
                )}
                {message.scene_prompt_en && (
                  <Typography
                    variant="body2"
                    sx={{
                      padding: 1,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      borderLeft: '3px solid #4caf50'
                    }}
                  >
                    <strong>English Prompt:</strong> {message.scene_prompt_en}
                  </Typography>
                )}
              </Box>
            )}

            {/* Scene Characters */}
            {(message.scene_prompt_ja || message.scene_prompt_en) && characters && characters.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <MessageCharacterSelector
                  messageId={message.id}
                  availableCharacters={characters.map(c => ({
                    id: c.id,
                    name: c.name,
                    image_url: c.image_url || null
                  }))}
                  onUpdate={() => {
                    // Refresh conversation view if needed
                    console.log('[ConversationViewer] Message characters updated');
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Actions */}
      {!readonly && isEditing && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            flexDirection: 'column'
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="保存">
              <IconButton
                size="small"
                color="primary"
                onClick={() => onSave(message.id)}
                disabled={saving || !editText.trim()}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="キャンセル">
              <IconButton
                size="small"
                onClick={onCancel}
                disabled={saving}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="感情タグを再分析">
              <IconButton
                size="small"
                color="secondary"
                onClick={() => onReanalyzeEmotion(message.id)}
                disabled={saving || reanalyzing}
              >
                <AutoFixHighIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="削除">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  if (confirm('このメッセージを削除しますか？')) {
                    onDelete(message.id);
                  }
                }}
                disabled={saving || reanalyzing}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Paper>
    {/* Insert After Button */}
    {showInsertButton && !readonly && onInsertAfter && (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          my: 1
        }}
      >
        <Tooltip title="このメッセージの後にメッセージを追加">
          <IconButton
            size="small"
            onClick={() => onInsertAfter(message.id)}
            sx={{
              borderRadius: '50%',
              border: '1px dashed',
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.light',
                color: 'white',
                borderStyle: 'solid'
              }
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    )}
  </>
  );
}

export default function ConversationViewer({
  messages,
  characters,
  onUpdateMessage,
  onReorderMessages,
  onDeleteMessage,
  onReanalyzeEmotion,
  onAddMessage,
  readonly = false
}: ConversationViewerProps) {
  const [localMessages, setLocalMessages] = useState(messages);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editCharacterId, setEditCharacterId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<number | null>(null);
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [insertAfterMessageId, setInsertAfterMessageId] = useState<number | undefined>(undefined);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Update local messages when props change
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  // Update edit text when editing message changes
  useEffect(() => {
    if (editingMessageId !== null) {
      const editingMessage = messages.find(m => m.id === editingMessageId);
      if (editingMessage && editingMessage.message_text !== editText) {
        setEditText(editingMessage.message_text);
      }
    }
  }, [messages, editingMessageId]);

  const handleEditClick = (message: ConversationMessageWithCharacter) => {
    setEditingMessageId(message.id);
    setEditText(message.message_text);
    setEditCharacterId(message.character_id);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
    setEditCharacterId(null);
  };

  const handleSaveEdit = async (messageId: number) => {
    if (!onUpdateMessage || !editText.trim()) {
      return;
    }

    const originalMessage = localMessages.find(m => m.id === messageId);
    const updates: { messageText?: string; characterId?: number } = {};

    if (editText.trim() !== originalMessage?.message_text) {
      updates.messageText = editText.trim();
    }

    if (editCharacterId !== null && editCharacterId !== originalMessage?.character_id) {
      updates.characterId = editCharacterId;
    }

    if (Object.keys(updates).length === 0) {
      handleCancelEdit();
      return;
    }

    setSaving(true);
    try {
      await onUpdateMessage(messageId, updates);

      // Update local state
      setLocalMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            const updatedMsg = { ...msg };
            if (updates.messageText) {
              updatedMsg.message_text = updates.messageText;
            }
            if (updates.characterId) {
              updatedMsg.character_id = updates.characterId;
              const character = characters?.find(c => c.id === updates.characterId);
              if (character) {
                updatedMsg.speaker_name = character.name;
                updatedMsg.character = {
                  id: character.id,
                  name: character.name,
                  image_url: character.image_url || null
                };
              }
            }
            return updatedMsg;
          }
          return msg;
        })
      );

      handleCancelEdit();
    } catch (error) {
      console.error('Failed to update message:', error);
      alert('メッセージの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyzeEmotion = async (messageId: number) => {
    if (!onReanalyzeEmotion) return;

    setReanalyzingId(messageId);
    try {
      await onReanalyzeEmotion(messageId);
    } catch (error) {
      console.error('Failed to reanalyze emotion:', error);
      alert('感情タグの再分析に失敗しました');
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleOpenTagSelector = () => {
    setTagSelectorOpen(true);
  };

  const handleSelectTag = (tagName: string) => {
    // カーソル位置にタグを挿入
    const textarea = textFieldRef.current;
    if (!textarea) {
      // フォールバック: textareaが取得できない場合は末尾に追加
      setEditText(editText + `[${tagName}]`);
      return;
    }

    const cursorPosition = textarea.selectionStart || 0;
    const textBefore = editText.substring(0, cursorPosition);
    const textAfter = editText.substring(cursorPosition);
    const newText = textBefore + `[${tagName}]` + textAfter;

    setEditText(newText);

    // カーソル位置をタグの後ろに移動
    setTimeout(() => {
      const newCursorPosition = cursorPosition + tagName.length + 2; // [tagName] の長さ
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      textarea.focus();
    }, 0);
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!onDeleteMessage) return;

    try {
      await onDeleteMessage(messageId);

      // Update local state - remove the message
      setLocalMessages(prev => prev.filter(msg => msg.id !== messageId));

      // Close editing mode if this message was being edited
      if (editingMessageId === messageId) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('メッセージの削除に失敗しました');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localMessages.findIndex((msg) => msg.id === active.id);
    const newIndex = localMessages.findIndex((msg) => msg.id === over.id);

    const reorderedMessages = arrayMove(localMessages, oldIndex, newIndex).map(
      (msg, index) => ({
        ...msg,
        sequence_order: index
      })
    );

    setLocalMessages(reorderedMessages);

    if (onReorderMessages) {
      try {
        await onReorderMessages(reorderedMessages);
      } catch (error) {
        console.error('Failed to reorder messages:', error);
        // Revert on error
        setLocalMessages(messages);
        alert('並び替えに失敗しました');
      }
    }
  };

  const handleAddMessage = async (characterId: number, messageText: string, emotionTag?: string) => {
    if (!onAddMessage) return;

    try {
      await onAddMessage(characterId, messageText, emotionTag, insertAfterMessageId);
      setAddDialogOpen(false);
      setInsertAfterMessageId(undefined);
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error; // Re-throw to let dialog handle the error
    }
  };

  const handleOpenAddDialog = (afterMessageId?: number) => {
    setInsertAfterMessageId(afterMessageId);
    setAddDialogOpen(true);
  };

  if (localMessages.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          color: 'text.secondary'
        }}
      >
        <Typography>メッセージがありません</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, margin: '0 auto', padding: 2 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localMessages.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {localMessages.map((message) => (
            <SortableMessage
              key={message.id}
              message={message}
              isEditing={editingMessageId === message.id}
              editText={editText}
              editCharacterId={editCharacterId}
              characters={characters}
              saving={saving}
              reanalyzing={reanalyzingId === message.id}
              readonly={readonly}
              showInsertButton={!readonly && !!onAddMessage && !!characters && characters.length > 0}
              onEditClick={handleEditClick}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onDelete={handleDeleteMessage}
              onReanalyzeEmotion={handleReanalyzeEmotion}
              onTextChange={setEditText}
              onCharacterChange={setEditCharacterId}
              onOpenTagSelector={handleOpenTagSelector}
              onInsertAfter={handleOpenAddDialog}
              textFieldRef={textFieldRef}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Emotion Tag Selector Dialog */}
      <EmotionTagSelector
        open={tagSelectorOpen}
        onClose={() => setTagSelectorOpen(false)}
        onSelectTag={handleSelectTag}
      />

      {/* Message Add Dialog */}
      {characters && characters.length > 0 && (
        <MessageAddDialog
          open={addDialogOpen}
          characters={characters}
          insertAfterMessage={
            insertAfterMessageId
              ? localMessages.find(m => m.id === insertAfterMessageId)
              : null
          }
          onClose={() => {
            setAddDialogOpen(false);
            setInsertAfterMessageId(undefined);
          }}
          onAdd={handleAddMessage}
        />
      )}
    </Box>
  );
}
