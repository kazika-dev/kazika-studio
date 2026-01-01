'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import MovieIcon from '@mui/icons-material/Movie';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ConversationViewer from '@/components/studio/conversation/ConversationViewer';
import WorkflowSelectionDialog from '@/components/studio/conversation/WorkflowSelectionDialog';
import type {
  Conversation,
  ConversationMessageWithCharacter,
  GetConversationResponse,
} from '@/types/conversation';

interface ConversationListItem {
  id: number;
  title: string;
  description?: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  storyTitle?: string;
  sceneTitle?: string;
}

interface Character {
  id: number;
  name: string;
  image_url?: string;
}

export default function ConversationsFocusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get('id');

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ConversationListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessageWithCharacter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [creatingStudio, setCreatingStudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowSelectionDialogOpen, setWorkflowSelectionDialogOpen] = useState(false);

  // Load all conversations (flat list)
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations');
      const result = await response.json();

      if (result.success && result.data) {
        const conversationList: ConversationListItem[] = result.data.conversations.map((conv: any) => ({
          id: conv.id,
          title: conv.title,
          description: conv.description,
          messageCount: conv.message_count || conv.messageCount || 0,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          storyTitle: conv.story_scene?.story?.title,
          sceneTitle: conv.story_scene?.title,
        }));
        setConversations(conversationList);
        setFilteredConversations(conversationList);
      } else {
        setError(result.error || '会話一覧の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('会話一覧の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load a specific conversation
  const loadConversation = useCallback(async (conversationId: number) => {
    setLoadingConversation(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      const result: GetConversationResponse = await response.json();

      if (result.success && result.data) {
        setSelectedConversation(result.data.conversation);
        setMessages(result.data.messages);
      } else {
        setError(result.error || '会話の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('会話の読み込みに失敗しました');
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  // Load all characters
  const loadAllCharacters = useCallback(async () => {
    try {
      const response = await fetch('/api/characters');
      const result = await response.json();

      if (result.success && result.data) {
        const mappedCharacters = result.data.characters.map((c: any) => ({
          id: c.id,
          name: c.name,
          image_url: c.image_url
        }));
        setCharacters(mappedCharacters);
      }
    } catch (error) {
      console.error('Failed to load all characters:', error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadAllCharacters();
  }, [loadConversations, loadAllCharacters]);

  // Load conversation from URL parameter
  useEffect(() => {
    if (conversationIdParam) {
      const id = parseInt(conversationIdParam, 10);
      if (!isNaN(id)) {
        loadConversation(id);
      }
    }
  }, [conversationIdParam, loadConversation]);

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = conversations.filter(conv =>
      conv.title.toLowerCase().includes(query) ||
      conv.description?.toLowerCase().includes(query) ||
      conv.storyTitle?.toLowerCase().includes(query) ||
      conv.sceneTitle?.toLowerCase().includes(query)
    );
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  const handleSelectConversation = (conversationId: number) => {
    router.push(`/conversationsfocus?id=${conversationId}`);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setMessages([]);
    router.push('/conversationsfocus');
  };

  const handleUpdateMessage = async (messageId: number, updates: { messageText?: string; characterId?: number; scenePromptJa?: string; scenePromptEn?: string }) => {
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const result = await response.json();

      if (result.success && result.data) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId ? result.data.message : msg
          )
        );
      } else {
        throw new Error(result.error || 'Failed to update message');
      }
    } catch (error) {
      console.error('Failed to update message:', error);
      throw error;
    }
  };

  const handleReorderMessages = async (reorderedMessages: ConversationMessageWithCharacter[]) => {
    if (!selectedConversation) return;

    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: reorderedMessages.map(msg => ({
            id: msg.id,
            sequence_order: msg.sequence_order
          }))
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to reorder messages');
      }

      setMessages(reorderedMessages);
    } catch (error) {
      console.error('Failed to reorder messages:', error);
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete message');
      }

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  const handleReanalyzeEmotion = async (messageId: number) => {
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}/reanalyze-emotion`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success && result.data) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  message_text: result.data.message.message_text,
                  metadata: result.data.message.metadata,
                }
              : msg
          )
        );
      } else {
        throw new Error(result.error || 'Failed to reanalyze emotion');
      }
    } catch (error) {
      console.error('Failed to reanalyze emotion:', error);
      throw error;
    }
  };

  const handleAddMessage = async (characterId: number, messageText: string, emotionTag?: string, insertAfterMessageId?: number) => {
    if (!selectedConversation) return;

    try {
      const response = await fetch('/api/conversations/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          characterId,
          messageText,
          emotionTag,
          insertAfterMessageId
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        if (insertAfterMessageId) {
          await loadConversation(selectedConversation.id);
        } else {
          setMessages(prev => [...prev, result.data.message]);
        }
      } else {
        throw new Error(result.error || 'Failed to add message');
      }
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error;
    }
  };

  const handleCreateStudioClick = () => {
    if (!selectedConversation) return;
    setWorkflowSelectionDialogOpen(true);
  };

  const handleWorkflowSelected = async (workflowIds: number[]) => {
    if (!selectedConversation) return;

    setCreatingStudio(true);
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/create-studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowIds: workflowIds,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const message = workflowIds.length > 0
          ? `スタジオ「${result.data.studioName}」を作成しました！\n${result.data.boardCount}個のボードと${result.data.workflowStepCount || 0}個のワークフローステップ（${workflowIds.length}種類のワークフロー）が作成されました。`
          : `スタジオ「${result.data.studioName}」を作成しました！\n${result.data.boardCount}個のボードが作成されました。`;
        alert(message);
        router.push(`/studios/${result.data.studioId}`);
      } else {
        throw new Error(result.error || 'Failed to create studio');
      }
    } catch (error) {
      console.error('Failed to create studio:', error);
      alert('スタジオの作成に失敗しました');
    } finally {
      setCreatingStudio(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1280, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // Show conversation detail view
  if (selectedConversation) {
    return (
      <Box sx={{ maxWidth: 1280, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
        {/* Header with back button */}
        <Box sx={{ marginBottom: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
            <IconButton onClick={handleBackToList} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <ChatIcon sx={{ fontSize: 32 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5">{selectedConversation.title}</Typography>
              {selectedConversation.description && (
                <Typography variant="body2" color="text.secondary">
                  {selectedConversation.description}
                </Typography>
              )}
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<MovieIcon />}
              onClick={handleCreateStudioClick}
              disabled={creatingStudio || messages.length === 0}
            >
              {creatingStudio ? 'スタジオを作成中...' : 'スタジオを作成'}
            </Button>
          </Box>
          <Divider />
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Conversation content */}
        <Paper elevation={2} sx={{ padding: 3, minHeight: 'calc(100vh - 300px)' }}>
          {loadingConversation ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              <CircularProgress />
            </Box>
          ) : (
            <ConversationViewer
              messages={messages}
              characters={characters}
              onUpdateMessage={handleUpdateMessage}
              onReorderMessages={handleReorderMessages}
              onDeleteMessage={handleDeleteMessage}
              onReanalyzeEmotion={handleReanalyzeEmotion}
              onAddMessage={handleAddMessage}
            />
          )}
        </Paper>

        {/* Workflow Selection Dialog */}
        <WorkflowSelectionDialog
          open={workflowSelectionDialogOpen}
          onClose={() => setWorkflowSelectionDialogOpen(false)}
          onSelect={handleWorkflowSelected}
        />
      </Box>
    );
  }

  // Show conversation list view
  return (
    <Box sx={{ maxWidth: 1280, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
      {/* Header */}
      <Box sx={{ marginBottom: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <ChatIcon sx={{ fontSize: 32 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4">会話一覧</Typography>
            <Typography variant="body2" color="text.secondary">
              会話を選択して編集・スタジオ作成
            </Typography>
          </Box>
          <Tooltip title="会話一覧を更新">
            <IconButton onClick={() => loadConversations()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            onClick={() => router.push('/conversations')}
          >
            ストーリー階層表示へ
          </Button>
        </Box>
        <Divider />
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="会話を検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Conversation List */}
      <Paper elevation={2}>
        {filteredConversations.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <ChatIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
            <Typography variant="h6">
              {searchQuery ? '検索結果がありません' : '会話がありません'}
            </Typography>
            <Typography variant="body2">
              {searchQuery ? '別のキーワードで検索してください' : 'ストーリー階層表示から会話を作成してください'}
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredConversations.map((conv, index) => (
              <Box key={conv.id}>
                <ListItemButton
                  onClick={() => handleSelectConversation(conv.id)}
                  sx={{
                    py: 2,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <ChatIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {conv.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({conv.messageCount}件のメッセージ)
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        {conv.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {conv.description}
                          </Typography>
                        )}
                        {(conv.storyTitle || conv.sceneTitle) && (
                          <Typography variant="caption" color="text.secondary">
                            {conv.storyTitle && `${conv.storyTitle}`}
                            {conv.storyTitle && conv.sceneTitle && ' / '}
                            {conv.sceneTitle && `${conv.sceneTitle}`}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
                {index < filteredConversations.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
