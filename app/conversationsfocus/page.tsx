'use client';

import { useEffect, useState } from 'react';
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
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import SettingsIcon from '@mui/icons-material/Settings';
import QueueIcon from '@mui/icons-material/Queue';
import ConversationViewerSimple from '@/components/studio/conversation/ConversationViewerSimple';
import CreatePromptQueueFromConversationDialog from '@/components/studio/conversation/CreatePromptQueueFromConversationDialog';
import StoryTreeView from '@/components/studio/conversation/StoryTreeView';
import StoryCreationDialog from '@/components/studio/conversation/StoryCreationDialog';
import SceneCreationDialog from '@/components/studio/conversation/SceneCreationDialog';
import ConversationGeneratorDialogWithScene from '@/components/studio/conversation/ConversationGeneratorDialogWithScene';
import ConversationSettingsDialog from '@/components/studio/conversation/ConversationSettingsDialog';
import type {
  Conversation,
  ConversationMessageWithCharacter,
  GetConversationResponse,
  StoryTreeNode,
  ConversationDraftParams,
} from '@/types/conversation';
import { generateSrt, downloadSrt } from '@/lib/utils/srt';

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
  const [storyTree, setStoryTree] = useState<StoryTreeNode[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithCount | null>(null);
  const [messages, setMessages] = useState<ConversationMessageWithCharacter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [generatingFromDraft, setGeneratingFromDraft] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [promptQueueDialogOpen, setPromptQueueDialogOpen] = useState(false);

  // Get story info for the selected conversation using story_scene_id
  const getStoryInfoForConversation = (storySceneId: number | null | undefined): { id: number; title: string; sceneTitle?: string } | undefined => {
    if (!storySceneId) return undefined;
    for (const storyNode of storyTree) {
      const foundScene = storyNode.scenes.find(sceneNode => sceneNode.scene.id === storySceneId);
      if (foundScene) {
        return {
          id: storyNode.story.id,
          title: storyNode.story.title,
          sceneTitle: foundScene.scene.title,
        };
      }
    }
    return undefined;
  };

  const storyInfo = selectedConversation
    ? getStoryInfoForConversation(selectedConversation.story_scene_id)
    : undefined;

  // Use story title if available, otherwise use story ID, or default to 'kazikastudio'
  const currentStoryTitle = storyInfo?.title || (storyInfo?.id ? `story${storyInfo.id}` : 'kazikastudio');

  useEffect(() => {
    loadStoryTree();
    loadAllCharacters();
  }, []);

  const loadStoryTree = async () => {
    try {
      const response = await fetch('/api/stories/tree');
      const result = await response.json();

      if (result.success && result.data) {
        console.log('[loadStoryTree] Tree data:', JSON.stringify(result.data.tree, null, 2));
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

  const handleDownloadSrt = () => {
    if (!selectedConversation || messages.length === 0) return;

    const srtContent = generateSrt(messages, {
      maxCharsPerChunk: 11,  // 11文字以内で文節区切り
    });
    const filename = selectedConversation.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
    downloadSrt(srtContent, filename);
  };

  const handleCreateScene = (storyId: number) => {
    setSelectedStoryId(storyId);
    setSceneDialogOpen(true);
  };

  const handleCreateConversation = (sceneId: number) => {
    setSelectedSceneId(sceneId);
    setConversationDialogOpen(true);
  };

  const handleConversationGenerated = async (conversationId: number) => {
    await loadStoryTree();
    await loadConversation(conversationId);
  };

  // Generate conversation from draft params
  const handleGenerateFromDraft = async () => {
    if (!selectedConversation?.id) return;

    setGeneratingFromDraft(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        // Reload conversation to get generated messages
        await loadConversation(selectedConversation.id);
        await loadStoryTree();
      } else {
        setError(result.error || '会話の生成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to generate from draft:', error);
      setError('会話の生成に失敗しました');
    } finally {
      setGeneratingFromDraft(false);
    }
  };

  // 選択したメッセージに対する一括操作
  const handleBulkReanalyzeSelectedEmotions = async (messageIds: number[]) => {
    if (!selectedConversation || messageIds.length === 0) return;

    try {
      const response = await fetch('/api/conversations/messages/bulk-update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds,
          action: 'reanalyze'
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Reload conversation to get updated messages
        await loadConversation(selectedConversation.id);
      } else {
        throw new Error(result.error || 'Failed to bulk reanalyze emotions');
      }
    } catch (error) {
      console.error('Failed to bulk reanalyze emotions:', error);
      throw error;
    }
  };

  const handleBulkAddTagToSelected = async (messageIds: number[], tagName: string) => {
    if (!selectedConversation || messageIds.length === 0) return;

    try {
      const response = await fetch('/api/conversations/messages/bulk-update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds,
          action: 'add',
          tagName
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Reload conversation to get updated messages
        await loadConversation(selectedConversation.id);
      } else {
        throw new Error(result.error || 'Failed to bulk add tag');
      }
    } catch (error) {
      console.error('Failed to bulk add tag:', error);
      throw error;
    }
  };

  const handleBulkRemoveTagsFromSelected = async (messageIds: number[]) => {
    if (!selectedConversation || messageIds.length === 0) return;

    try {
      const response = await fetch('/api/conversations/messages/bulk-update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds,
          action: 'remove'
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Reload conversation to get updated messages
        await loadConversation(selectedConversation.id);
      } else {
        throw new Error(result.error || 'Failed to bulk remove tags');
      }
    } catch (error) {
      console.error('Failed to bulk remove tags:', error);
      throw error;
    }
  };

  const handleBulkDeleteMessages = async (messageIds: number[]) => {
    if (!selectedConversation || messageIds.length === 0) return;

    try {
      // 並列で削除を実行
      const results = await Promise.all(
        messageIds.map(async (id) => {
          const response = await fetch(`/api/conversations/messages/${id}`, {
            method: 'DELETE'
          });
          return response.json();
        })
      );

      const failedCount = results.filter(r => !r.success).length;
      if (failedCount > 0) {
        throw new Error(`${messageIds.length - failedCount}件削除、${failedCount}件失敗しました`);
      }

      // Reload conversation to get updated messages
      await loadConversation(selectedConversation.id);
    } catch (error) {
      console.error('Failed to bulk delete messages:', error);
      throw error;
    }
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

  const handleBulkDeleteConversations = async (conversationIds: number[]) => {
    try {
      // 並列で削除を実行
      const results = await Promise.all(
        conversationIds.map(async (id) => {
          const response = await fetch(`/api/conversations/${id}`, {
            method: 'DELETE'
          });
          return response.json();
        })
      );

      const failedCount = results.filter(r => !r.success).length;
      if (failedCount > 0) {
        alert(`${conversationIds.length - failedCount}件削除、${failedCount}件失敗しました`);
      }

      await loadStoryTree();

      // 選択中の会話が削除された場合はクリア
      if (selectedConversation && conversationIds.includes(selectedConversation.id)) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to bulk delete conversations:', error);
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
              onCreateConversation={handleCreateConversation}
              onDeleteStory={handleDeleteStory}
              onDeleteScene={handleDeleteScene}
              onDeleteConversation={handleDeleteConversation}
              onBulkDeleteConversations={handleBulkDeleteConversations}
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
                      {/* 会話の場所（conversations.location）を表示 */}
                      {selectedConversation.location && (
                        <Typography variant="body2" color="primary" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          📍 場所: {selectedConversation.location}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        onClick={() => setSettingsDialogOpen(true)}
                      >
                        設定
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<SubtitlesIcon />}
                        onClick={handleDownloadSrt}
                        disabled={messages.length === 0}
                      >
                        SRTダウンロード
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<QueueIcon />}
                        onClick={() => setPromptQueueDialogOpen(true)}
                        disabled={messages.length === 0}
                      >
                        プロンプトキュー作成
                      </Button>
                    </Box>
                  </Box>
                  <Divider />
                </Box>
                <ConversationViewerSimple
                  messages={messages}
                  characters={characters}
                  storyTitle={currentStoryTitle}
                  conversationId={selectedConversation.id}
                  onUpdateMessage={handleUpdateMessage}
                  onReorderMessages={handleReorderMessages}
                  onDeleteMessage={handleDeleteMessage}
                  onReanalyzeEmotion={handleReanalyzeEmotion}
                  onAddMessage={handleAddMessage}
                  onGenerateAudio={handleGenerateAudio}
                  onContinueConversation={() => loadConversation(selectedConversation.id)}
                  onBulkReanalyzeSelectedEmotions={handleBulkReanalyzeSelectedEmotions}
                  onBulkAddTagToSelected={handleBulkAddTagToSelected}
                  onBulkRemoveTagsFromSelected={handleBulkRemoveTagsFromSelected}
                  onBulkDeleteMessages={handleBulkDeleteMessages}
                  hasDraftParams={!!selectedConversation.metadata?.draft_params}
                  onGenerateFromDraft={handleGenerateFromDraft}
                  generatingFromDraft={generatingFromDraft}
                  onOpenDraftEditDialog={() => setSettingsDialogOpen(true)}
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

      <ConversationGeneratorDialogWithScene
        open={conversationDialogOpen}
        sceneId={selectedSceneId}
        onClose={() => {
          setConversationDialogOpen(false);
          setSelectedSceneId(null);
        }}
        onGenerated={handleConversationGenerated}
      />

      {selectedConversation && (
        <ConversationSettingsDialog
          open={settingsDialogOpen}
          conversationId={selectedConversation.id}
          conversationTitle={selectedConversation.title}
          draftParams={(selectedConversation.metadata?.draft_params as ConversationDraftParams) || null}
          isGenerated={messages.length > 0}
          onClose={() => setSettingsDialogOpen(false)}
          onSaved={async () => {
            await loadConversation(selectedConversation.id);
            await loadStoryTree();
          }}
          onGenerated={async () => {
            await loadConversation(selectedConversation.id);
            await loadStoryTree();
          }}
        />
      )}

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
          }}
        />
      )}

    </Box>
  );
}
