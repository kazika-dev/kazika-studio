'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Button,
  Menu,
  MenuItem,
  Checkbox,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MovieIcon from '@mui/icons-material/Movie';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import type { StoryTreeNode } from '@/types/conversation';

interface StoryTreeViewProps {
  tree: StoryTreeNode[];
  selectedConversationId: number | null;
  onSelectConversation: (conversationId: number) => void;
  onCreateStory: () => void;
  onCreateScene: (storyId: number) => void;
  onCreateConversation?: (sceneId: number) => void;
  onDeleteStory: (storyId: number) => void;
  onDeleteScene: (sceneId: number) => void;
  onDeleteConversation: (conversationId: number) => void;
  onBulkDeleteConversations?: (conversationIds: number[]) => Promise<void>;
}

export default function StoryTreeView({
  tree,
  selectedConversationId,
  onSelectConversation,
  onCreateStory,
  onCreateScene,
  onCreateConversation,
  onDeleteStory,
  onDeleteScene,
  onDeleteConversation,
  onBulkDeleteConversations,
}: StoryTreeViewProps) {
  const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [storyMenuAnchor, setStoryMenuAnchor] = useState<{ anchor: HTMLElement; storyId: number } | null>(null);
  const [sceneMenuAnchor, setSceneMenuAnchor] = useState<{ anchor: HTMLElement; sceneId: number } | null>(null);
  const [conversationMenuAnchor, setConversationMenuAnchor] = useState<{ anchor: HTMLElement; conversationId: number } | null>(null);

  // 選択モード
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleStory = (storyId: number) => {
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
    }
    setExpandedStories(newExpanded);
  };

  const toggleScene = (sceneId: number) => {
    const newExpanded = new Set(expandedScenes);
    if (newExpanded.has(sceneId)) {
      newExpanded.delete(sceneId);
    } else {
      newExpanded.add(sceneId);
    }
    setExpandedScenes(newExpanded);
  };

  const toggleConversationSelection = (conversationId: number) => {
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  const handleSelectAll = () => {
    const allConversationIds = new Set<number>();
    tree.forEach(node => {
      node.scenes.forEach(sceneNode => {
        sceneNode.conversations.forEach(conv => {
          allConversationIds.add(conv.id);
        });
      });
    });
    setSelectedConversations(allConversationIds);
  };

  const handleDeselectAll = () => {
    setSelectedConversations(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedConversations(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedConversations.size === 0) return;

    if (!confirm(`選択した${selectedConversations.size}件の会話を削除しますか？`)) {
      return;
    }

    setDeleting(true);
    try {
      if (onBulkDeleteConversations) {
        await onBulkDeleteConversations(Array.from(selectedConversations));
      } else {
        // フォールバック: 1件ずつ削除
        for (const id of selectedConversations) {
          await onDeleteConversation(id);
        }
      }
      setSelectedConversations(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Failed to bulk delete conversations:', error);
      alert('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      {/* ヘッダーボタン */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onCreateStory}
          sx={{ flex: 1 }}
        >
          新しいストーリー
        </Button>
        <Button
          variant={selectionMode ? 'contained' : 'outlined'}
          size="small"
          color={selectionMode ? 'secondary' : 'primary'}
          startIcon={<CheckBoxIcon />}
          onClick={() => selectionMode ? handleExitSelectionMode() : setSelectionMode(true)}
        >
          {selectionMode ? '終了' : '選択'}
        </Button>
      </Box>

      {/* 選択モードのツールバー */}
      {selectionMode && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          p: 1,
          backgroundColor: 'action.hover',
          borderRadius: 1,
          flexWrap: 'wrap'
        }}>
          <Button size="small" onClick={handleSelectAll} disabled={deleting}>
            すべて選択
          </Button>
          <Button size="small" onClick={handleDeselectAll} disabled={deleting || selectedConversations.size === 0}>
            選択解除
          </Button>
          <Chip
            label={`${selectedConversations.size}件選択中`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
            disabled={deleting || selectedConversations.size === 0}
          >
            {deleting ? '削除中...' : '一括削除'}
          </Button>
        </Box>
      )}

      {/* ツリー表示 */}
      {tree.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          ストーリーがありません
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {tree.map((node) => {
            const isStoryExpanded = expandedStories.has(node.story.id);

            return (
              <Box key={node.story.id}>
                {/* ストーリー */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 1,
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <IconButton size="small" onClick={() => toggleStory(node.story.id)}>
                    {isStoryExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </IconButton>
                  <MenuBookIcon sx={{ fontSize: 20, mr: 1, color: 'primary.main' }} />
                  <Typography
                    variant="subtitle2"
                    sx={{ flex: 1, fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => toggleStory(node.story.id)}
                  >
                    {node.story.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => setStoryMenuAnchor({ anchor: e.currentTarget, storyId: node.story.id })}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* シーン一覧 */}
                <Collapse in={isStoryExpanded}>
                  <Box sx={{ pl: 3 }}>
                    {/* シーン作成ボタン */}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => onCreateScene(node.story.id)}
                      sx={{ mb: 1, fontSize: '0.75rem' }}
                    >
                      シーンを追加
                    </Button>

                    {node.scenes.map((sceneNode) => {
                      const isSceneExpanded = expandedScenes.has(sceneNode.scene.id);

                      return (
                        <Box key={sceneNode.scene.id}>
                          {/* シーン */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: 0.75,
                              borderRadius: 1,
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                            }}
                          >
                            <IconButton size="small" onClick={() => toggleScene(sceneNode.scene.id)}>
                              {isSceneExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                            </IconButton>
                            <MovieIcon sx={{ fontSize: 18, mr: 1, color: 'secondary.main' }} />
                            <Typography
                              variant="body2"
                              sx={{ flex: 1, cursor: 'pointer' }}
                              onClick={() => toggleScene(sceneNode.scene.id)}
                            >
                              {sceneNode.scene.title}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={(e) => setSceneMenuAnchor({ anchor: e.currentTarget, sceneId: sceneNode.scene.id })}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          {/* 会話一覧 */}
                          <Collapse in={isSceneExpanded}>
                            <Box sx={{ pl: 3 }}>
                              {/* 会話作成ボタン */}
                              <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => onCreateConversation?.(sceneNode.scene.id)}
                                sx={{ mb: 0.5, fontSize: '0.7rem' }}
                              >
                                会話を追加
                              </Button>

                              {sceneNode.conversations.map((conversation) => (
                                <Box
                                  key={conversation.id}
                                  onClick={() => {
                                    if (selectionMode) {
                                      toggleConversationSelection(conversation.id);
                                    } else {
                                      onSelectConversation(conversation.id);
                                    }
                                  }}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0.75,
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    backgroundColor:
                                      selectionMode && selectedConversations.has(conversation.id)
                                        ? 'primary.light'
                                        : selectedConversationId === conversation.id
                                        ? 'action.selected'
                                        : 'transparent',
                                    '&:hover': {
                                      backgroundColor:
                                        selectionMode && selectedConversations.has(conversation.id)
                                          ? 'primary.light'
                                          : selectedConversationId === conversation.id
                                          ? 'action.selected'
                                          : 'action.hover',
                                    },
                                  }}
                                >
                                  {selectionMode && (
                                    <Checkbox
                                      size="small"
                                      checked={selectedConversations.has(conversation.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={() => toggleConversationSelection(conversation.id)}
                                      sx={{ p: 0, mr: 1 }}
                                    />
                                  )}
                                  <ChatIcon sx={{ fontSize: 16, mr: 1, ml: selectionMode ? 0 : 3, color: 'text.secondary' }} />
                                  <Typography variant="body2" sx={{ flex: 1, fontSize: '0.875rem' }}>
                                    {conversation.title}
                                  </Typography>
                                  {!selectionMode && (
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConversationMenuAnchor({ anchor: e.currentTarget, conversationId: conversation.id });
                                      }}
                                    >
                                      <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ストーリーメニュー */}
      <Menu
        open={Boolean(storyMenuAnchor)}
        anchorEl={storyMenuAnchor?.anchor}
        onClose={() => setStoryMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (storyMenuAnchor && confirm('このストーリーを削除しますか？')) {
              onDeleteStory(storyMenuAnchor.storyId);
            }
            setStoryMenuAnchor(null);
          }}
        >
          削除
        </MenuItem>
      </Menu>

      {/* シーンメニュー */}
      <Menu
        open={Boolean(sceneMenuAnchor)}
        anchorEl={sceneMenuAnchor?.anchor}
        onClose={() => setSceneMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (sceneMenuAnchor && confirm('このシーンを削除しますか？')) {
              onDeleteScene(sceneMenuAnchor.sceneId);
            }
            setSceneMenuAnchor(null);
          }}
        >
          削除
        </MenuItem>
      </Menu>

      {/* 会話メニュー */}
      <Menu
        open={Boolean(conversationMenuAnchor)}
        anchorEl={conversationMenuAnchor?.anchor}
        onClose={() => setConversationMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (conversationMenuAnchor && confirm('この会話を削除しますか？')) {
              onDeleteConversation(conversationMenuAnchor.conversationId);
            }
            setConversationMenuAnchor(null);
          }}
        >
          削除
        </MenuItem>
      </Menu>
    </Box>
  );
}
