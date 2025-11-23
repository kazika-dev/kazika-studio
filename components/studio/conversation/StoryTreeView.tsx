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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MovieIcon from '@mui/icons-material/Movie';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { StoryTreeNode, Conversation } from '@/types/conversation';

interface StoryTreeViewProps {
  tree: StoryTreeNode[];
  selectedConversationId: number | null;
  onSelectConversation: (conversationId: number) => void;
  onCreateStory: () => void;
  onCreateScene: (storyId: number) => void;
  onCreateConversation: (sceneId: number) => void;
  onEditScene?: (sceneId: number) => void;
  onDeleteStory: (storyId: number) => void;
  onDeleteScene: (sceneId: number) => void;
  onDeleteConversation: (conversationId: number) => void;
}

export default function StoryTreeView({
  tree,
  selectedConversationId,
  onSelectConversation,
  onCreateStory,
  onCreateScene,
  onCreateConversation,
  onEditScene,
  onDeleteStory,
  onDeleteScene,
  onDeleteConversation,
}: StoryTreeViewProps) {
  const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [storyMenuAnchor, setStoryMenuAnchor] = useState<{ anchor: HTMLElement; storyId: number } | null>(null);
  const [sceneMenuAnchor, setSceneMenuAnchor] = useState<{ anchor: HTMLElement; sceneId: number } | null>(null);
  const [conversationMenuAnchor, setConversationMenuAnchor] = useState<{ anchor: HTMLElement; conversationId: number } | null>(null);

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

  return (
    <Box>
      {/* ストーリー作成ボタン */}
      <Button
        fullWidth
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onCreateStory}
        sx={{ mb: 2 }}
      >
        新しいストーリー
      </Button>

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
                                onClick={() => onCreateConversation(sceneNode.scene.id)}
                                sx={{ mb: 0.5, fontSize: '0.7rem' }}
                              >
                                会話を追加
                              </Button>

                              {sceneNode.conversations.map((conversation) => (
                                <Box
                                  key={conversation.id}
                                  onClick={() => onSelectConversation(conversation.id)}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0.75,
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    backgroundColor:
                                      selectedConversationId === conversation.id ? 'action.selected' : 'transparent',
                                    '&:hover': {
                                      backgroundColor:
                                        selectedConversationId === conversation.id ? 'action.selected' : 'action.hover',
                                    },
                                  }}
                                >
                                  <ChatIcon sx={{ fontSize: 16, mr: 1, ml: 3, color: 'text.secondary' }} />
                                  <Typography variant="body2" sx={{ flex: 1, fontSize: '0.875rem' }}>
                                    {conversation.title}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConversationMenuAnchor({ anchor: e.currentTarget, conversationId: conversation.id });
                                    }}
                                  >
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
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
        {onEditScene && (
          <MenuItem
            onClick={() => {
              if (sceneMenuAnchor) {
                onEditScene(sceneMenuAnchor.sceneId);
              }
              setSceneMenuAnchor(null);
            }}
          >
            キャラクター管理
          </MenuItem>
        )}
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
