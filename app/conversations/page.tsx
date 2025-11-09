'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import MovieIcon from '@mui/icons-material/Movie';
import ConversationViewer from '@/components/studio/conversation/ConversationViewer';
import ConversationList from '@/components/studio/conversation/ConversationList';
import ConversationGeneratorDialogStandalone from '@/components/studio/conversation/ConversationGeneratorDialogStandalone';
import WorkflowSelectionDialog from '@/components/studio/conversation/WorkflowSelectionDialog';
import type {
  Conversation,
  ConversationMessageWithCharacter,
  GetConversationResponse,
  ListConversationsResponse
} from '@/types/conversation';

interface ConversationWithCount extends Conversation {
  messageCount?: number;
  studios?: {
    id: number;
    name: string;
  };
}

interface Character {
  id: number;
  name: string;
  image_url?: string;
}

export default function ConversationsPage() {
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationWithCount[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithCount | null>(null);
  const [messages, setMessages] = useState<ConversationMessageWithCharacter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [creatingStudio, setCreatingStudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false);
  const [workflowSelectionDialogOpen, setWorkflowSelectionDialogOpen] = useState(false);

  useEffect(() => {
    loadConversations();
    loadAllCharacters();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const result: ListConversationsResponse = await response.json();

      if (result.success && result.data) {
        setConversations(result.data.conversations);
      } else {
        setError(result.error || '会話一覧の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('会話一覧の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (conversationId: number) => {
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
  };

  const loadAllCharacters = async () => {
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
  };

  const handleSelectConversation = (conversationId: number) => {
    loadConversation(conversationId);
  };

  const handleDeleteConversation = async (conversationId: number) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await loadConversations();
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
          setMessages([]);
        }
      } else {
        alert(`削除に失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('削除に失敗しました');
    }
  };

  const handleUpdateMessage = async (messageId: number, updates: { messageText?: string; characterId?: number }) => {
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

      // Update local state
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

      // Update local state - remove the message
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  const handleConversationGenerated = async (conversationId: number) => {
    // Reload conversations list
    await loadConversations();
    // Load the newly generated conversation
    await loadConversation(conversationId);
  };

  const handleCreateStudioClick = () => {
    if (!selectedConversation) return;
    setWorkflowSelectionDialogOpen(true);
  };

  const handleWorkflowSelected = async (workflowId: number | null) => {
    if (!selectedConversation) return;

    setCreatingStudio(true);
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/create-studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflowId,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const message = workflowId
          ? `スタジオ「${result.data.studioName}」を作成しました！\n${result.data.boardCount}個のボードと${result.data.workflowStepCount || 0}個のワークフローステップが作成されました。`
          : `スタジオ「${result.data.studioName}」を作成しました！\n${result.data.boardCount}個のボードが作成されました。`;
        alert(message);
        // Redirect to the studio page
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

  return (
    <Box sx={{ maxWidth: 1536, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
      {/* Header */}
      <Box sx={{ marginBottom: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <ChatIcon sx={{ fontSize: 32 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4">全ての会話</Typography>
            <Typography variant="body2" color="text.secondary">
              全てのスタジオの会話を表示
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setGeneratorDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            新しい会話を生成
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push('/studios')}
          >
            スタジオ一覧
          </Button>
        </Box>
        <Divider />
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Content */}
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Conversation List (Left Sidebar) */}
        <Box sx={{ width: { xs: '100%', md: '33%' } }}>
          <Paper elevation={2} sx={{ padding: 2, height: 'calc(100vh - 250px)', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              会話一覧
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {conversations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                会話がありません
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {conversations.map((conv) => (
                  <Box
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    sx={{
                      padding: 2,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedConversation?.id === conv.id ? 'action.selected' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {conv.title}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('この会話を削除しますか？')) {
                            handleDeleteConversation(conv.id);
                          }
                        }}
                        sx={{ minWidth: 'auto', padding: '2px 8px' }}
                      >
                        削除
                      </Button>
                    </Box>
                    {conv.studios && (
                      <Chip
                        label={conv.studios.name}
                        size="small"
                        sx={{ mb: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/studios/${conv.studios?.id}`);
                        }}
                      />
                    )}
                    {conv.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mb: 1 }}>
                        {conv.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {conv.messageCount || 0} メッセージ
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>

        {/* Conversation Viewer (Main Content) */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={{ padding: 3, minHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
            {loadingConversation ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
              </Box>
            ) : selectedConversation ? (
              <>
                <Box sx={{ marginBottom: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" gutterBottom>
                        {selectedConversation.title}
                      </Typography>
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
                      sx={{ ml: 2 }}
                    >
                      {creatingStudio ? 'スタジオを作成中...' : 'スタジオを作成'}
                    </Button>
                  </Box>
                  <Divider />
                </Box>
                <ConversationViewer
                  messages={messages}
                  characters={characters}
                  onUpdateMessage={handleUpdateMessage}
                  onReorderMessages={handleReorderMessages}
                  onDeleteMessage={handleDeleteMessage}
                />
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 400,
                  color: 'text.secondary',
                  gap: 2
                }}
              >
                <ChatIcon sx={{ fontSize: 80, opacity: 0.3 }} />
                <Typography variant="h6">会話を選択してください</Typography>
                <Typography variant="body2">
                  左側のリストから会話を選択してください
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Generator Dialog */}
      <ConversationGeneratorDialogStandalone
        open={generatorDialogOpen}
        onClose={() => setGeneratorDialogOpen(false)}
        onGenerated={handleConversationGenerated}
      />

      {/* Workflow Selection Dialog */}
      <WorkflowSelectionDialog
        open={workflowSelectionDialogOpen}
        onClose={() => setWorkflowSelectionDialogOpen(false)}
        onSelect={handleWorkflowSelected}
      />
    </Box>
  );
}
