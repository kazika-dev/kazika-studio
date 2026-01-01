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
  Divider
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import MovieIcon from '@mui/icons-material/Movie';
import ConversationViewerSimple from '@/components/studio/conversation/ConversationViewerSimple';
import StoryTreeView from '@/components/studio/conversation/StoryTreeView';
import StoryCreationDialog from '@/components/studio/conversation/StoryCreationDialog';
import SceneCreationDialog from '@/components/studio/conversation/SceneCreationDialog';
import WorkflowSelectionDialog from '@/components/studio/conversation/WorkflowSelectionDialog';
import type {
  Conversation,
  ConversationMessageWithCharacter,
  GetConversationResponse,
  StoryTreeNode,
} from '@/types/conversation';

interface ConversationWithCount extends Conversation {
  messageCount?: number;
  sceneCount?: number;
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

export default function ConversationsFocusPage() {
  const router = useRouter();

  const [storyTree, setStoryTree] = useState<StoryTreeNode[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithCount | null>(null);
  const [messages, setMessages] = useState<ConversationMessageWithCharacter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [creatingStudio, setCreatingStudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
  const [workflowSelectionDialogOpen, setWorkflowSelectionDialogOpen] = useState(false);

  // Get story title for the selected conversation using story_scene_id
  const getStoryTitleForConversation = (storySceneId: number | null | undefined): string | undefined => {
    if (!storySceneId) return undefined;
    for (const storyNode of storyTree) {
      const foundScene = storyNode.scenes.find(sceneNode => sceneNode.scene.id === storySceneId);
      if (foundScene) {
        return storyNode.story.title;
      }
    }
    return undefined;
  };

  const currentStoryTitle = selectedConversation
    ? getStoryTitleForConversation(selectedConversation.story_scene_id)
    : undefined;

  // Debug log
  console.log('[DEBUG] selectedConversation.story_scene_id:', selectedConversation?.story_scene_id, 'currentStoryTitle:', currentStoryTitle);

  useEffect(() => {
    loadStoryTree();
    loadAllCharacters();
  }, []);

  const loadStoryTree = async () => {
    try {
      const response = await fetch('/api/stories/tree');
      const result = await response.json();

      if (result.success && result.data) {
        setStoryTree(result.data.tree);
      } else {
        setError(result.error || 'ストーリーツリーの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load story tree:', error);
      setError('ストーリーツリーの読み込みに失敗しました');
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
        await loadStoryTree();
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
        // Update the message with new emotion tag
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
        // If inserting after a message, reload the entire conversation to get updated sequence_order
        if (insertAfterMessageId) {
          await loadConversation(selectedConversation.id);
        } else {
          // If adding at the end, just append to the list
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

  const handleGenerateAudio = async (messageId: number): Promise<{ audioUrl: string } | null> => {
    try {
      const response = await fetch(`/api/conversations/messages/${messageId}/generate-audio`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Update message in local state with audio info
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? { ...msg, ...result.data.message }
              : msg
          )
        );
        return { audioUrl: result.data.audioUrl };
      } else {
        throw new Error(result.error || 'Failed to generate audio');
      }
    } catch (error) {
      console.error('Failed to generate audio:', error);
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

  const handleCreateScene = (storyId: number) => {
    setSelectedStoryId(storyId);
    setSceneDialogOpen(true);
  };

  const handleDeleteStory = async (storyId: number) => {
    try {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await loadStoryTree();
      } else {
        alert(`削除に失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete story:', error);
      alert('削除に失敗しました');
    }
  };

  const handleDeleteScene = async (sceneId: number) => {
    try {
      const response = await fetch(`/api/scenes/${sceneId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await loadStoryTree();
      } else {
        alert(`削除に失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete scene:', error);
      alert('削除に失敗しました');
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
            <Typography variant="h4">ストーリー・シーン・会話</Typography>
            <Typography variant="body2" color="text.secondary">
              ストーリーごとにシーンと会話を管理
            </Typography>
          </Box>
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
        {/* Story Tree (Left Sidebar) */}
        <Box sx={{ width: { xs: '100%', md: '33%' } }}>
          <Paper elevation={2} sx={{ padding: 2, height: 'calc(100vh - 250px)', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              ストーリー階層
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <StoryTreeView
              tree={storyTree}
              selectedConversationId={selectedConversation?.id || null}
              onSelectConversation={handleSelectConversation}
              onCreateStory={() => setStoryDialogOpen(true)}
              onCreateScene={handleCreateScene}
              onDeleteStory={handleDeleteStory}
              onDeleteScene={handleDeleteScene}
              onDeleteConversation={handleDeleteConversation}
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
                <ConversationViewerSimple
                  messages={messages}
                  characters={characters}
                  storyTitle={currentStoryTitle}
                  onUpdateMessage={handleUpdateMessage}
                  onReorderMessages={handleReorderMessages}
                  onDeleteMessage={handleDeleteMessage}
                  onReanalyzeEmotion={handleReanalyzeEmotion}
                  onAddMessage={handleAddMessage}
                  onGenerateAudio={handleGenerateAudio}
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
                  左側のツリーから会話を選択してください
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Dialogs */}
      <StoryCreationDialog
        open={storyDialogOpen}
        onClose={() => setStoryDialogOpen(false)}
        onCreated={async () => {
          await loadStoryTree();
        }}
      />

      <SceneCreationDialog
        open={sceneDialogOpen}
        storyId={selectedStoryId}
        onClose={() => {
          setSceneDialogOpen(false);
          setSelectedStoryId(null);
        }}
        onCreated={async () => {
          await loadStoryTree();
        }}
      />

      <WorkflowSelectionDialog
        open={workflowSelectionDialogOpen}
        onClose={() => setWorkflowSelectionDialogOpen(false)}
        onSelect={handleWorkflowSelected}
      />

    </Box>
  );
}
