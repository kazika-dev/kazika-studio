'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import QueueIcon from '@mui/icons-material/Queue';
import ConversationGeneratorDialog from '@/components/studio/conversation/ConversationGeneratorDialog';
import ConversationViewer from '@/components/studio/conversation/ConversationViewer';
import ConversationList from '@/components/studio/conversation/ConversationList';
import CreatePromptQueueFromConversationDialog from '@/components/studio/conversation/CreatePromptQueueFromConversationDialog';
import type {
  Conversation,
  ConversationMessageWithCharacter,
  GetConversationResponse,
  ListConversationsResponse
} from '@/types/conversation';

interface Studio {
  id: number;
  name: string;
  description: string;
}

interface ConversationWithCount extends Conversation {
  messageCount?: number;
}

interface Character {
  id: number;
  name: string;
  image_url?: string;
}

export default function StudioConversationPage() {
  const router = useRouter();
  const params = useParams();

  // Get studio ID from params
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const studioId = idParam ? parseInt(idParam, 10) : NaN;

  const [studio, setStudio] = useState<Studio | null>(null);
  const [conversations, setConversations] = useState<ConversationWithCount[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessageWithCharacter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false);
  const [promptQueueDialogOpen, setPromptQueueDialogOpen] = useState(false);

  useEffect(() => {
    if (!isNaN(studioId) && studioId > 0) {
      loadStudio();
      loadConversations();
      loadCharacters();
    } else if (idParam !== undefined) {
      setError('無効なスタジオIDです');
      setLoading(false);
    }
  }, [studioId, idParam]);

  const loadStudio = async () => {
    try {
      const response = await fetch(`/api/studios/${studioId}`);
      const result = await response.json();

      if (result.success && result.studio) {
        setStudio(result.studio);
      } else {
        setError('スタジオの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load studio:', error);
      setError('スタジオの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadCharacters = async () => {
    try {
      const response = await fetch(`/api/studios/${studioId}/characters`);
      const result = await response.json();

      if (result.success && result.data) {
        setCharacters(result.data.characters.map((c: any) => ({
          id: c.id,
          name: c.name,
          image_url: c.image_url
        })));
      }
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/conversations?studioId=${studioId}`);
      const result: ListConversationsResponse = await response.json();

      if (result.success && result.data) {
        setConversations(result.data.conversations);
      } else {
        setError(result.error || '会話一覧の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('会話一覧の読み込みに失敗しました');
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

  const handleConversationGenerated = async (conversationId: number) => {
    await loadConversations();
    await loadConversation(conversationId);
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
        // Reload conversations
        await loadConversations();
        // Clear selected conversation if it was deleted
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
        // Update message in local state
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

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1280, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error && !studio) {
    return (
      <Box sx={{ maxWidth: 1280, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/studios')}
          sx={{ mt: 2 }}
        >
          スタジオ一覧に戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1536, margin: '0 auto', paddingY: 4, paddingX: 3 }}>
      {/* Header */}
      <Box sx={{ marginBottom: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <IconButton onClick={() => router.push(`/studios/${studioId}`)}>
            <ArrowBackIcon />
          </IconButton>
          <ChatIcon sx={{ fontSize: 32 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4">会話管理</Typography>
            {studio && (
              <Typography variant="body2" color="text.secondary">
                {studio.name}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setGeneratorDialogOpen(true)}
          >
            新しい会話を生成
          </Button>
          {selectedConversation && (
            <Button
              variant="outlined"
              startIcon={<QueueIcon />}
              onClick={() => setPromptQueueDialogOpen(true)}
            >
              プロンプトキューを作成
            </Button>
          )}
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
            <ConversationList
              conversations={conversations}
              onSelect={handleSelectConversation}
              onDelete={handleDeleteConversation}
              selectedId={selectedConversation?.id || null}
            />
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
                  <Typography variant="h5" gutterBottom>
                    {selectedConversation.title}
                  </Typography>
                  {selectedConversation.description && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedConversation.description}
                    </Typography>
                  )}
                  <Divider sx={{ mt: 2 }} />
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
                  左側のリストから会話を選択するか、新しい会話を生成してください
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Generator Dialog */}
      <ConversationGeneratorDialog
        open={generatorDialogOpen}
        onClose={() => setGeneratorDialogOpen(false)}
        studioId={studioId}
        onGenerated={handleConversationGenerated}
      />

      {/* Prompt Queue Dialog */}
      {selectedConversation && (
        <CreatePromptQueueFromConversationDialog
          open={promptQueueDialogOpen}
          onClose={() => setPromptQueueDialogOpen(false)}
          conversationId={selectedConversation.id}
          conversationTitle={selectedConversation.title}
          messages={messages.map(m => ({
            id: m.id,
            speaker_name: m.speaker_name,
            message_text: m.message_text,
            sequence_order: m.sequence_order,
          }))}
          onSuccess={(result) => {
            console.log('Prompt queues created:', result);
            // 必要に応じてトースト通知などを追加
          }}
        />
      )}
    </Box>
  );
}
