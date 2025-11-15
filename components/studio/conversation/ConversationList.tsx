'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatIcon from '@mui/icons-material/Chat';
import type { Conversation } from '@/types/conversation';

interface ConversationWithCount extends Conversation {
  messageCount?: number;
}

interface ConversationListProps {
  conversations: ConversationWithCount[];
  onSelect: (conversationId: number) => void;
  onDelete?: (conversationId: number) => void;
  selectedId?: number | null;
}

export default function ConversationList({
  conversations,
  onSelect,
  onDelete,
  selectedId
}: ConversationListProps) {
  const handleDelete = (e: React.MouseEvent, conversationId: number) => {
    e.stopPropagation();
    if (onDelete && confirm('この会話を削除してもよろしいですか？')) {
      onDelete(conversationId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今日';
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  if (conversations.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
          color: 'text.secondary',
          gap: 2
        }}
      >
        <ChatIcon sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6">会話がありません</Typography>
        <Typography variant="body2">
          「新しい会話を生成」ボタンから会話を作成してください
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {conversations.map((conversation) => (
        <Card
          key={conversation.id}
          elevation={selectedId === conversation.id ? 4 : 1}
          sx={{
            border: selectedId === conversation.id ? 2 : 0,
            borderColor: 'primary.main',
            transition: 'all 0.2s',
            position: 'relative',
            '&:hover': {
              boxShadow: 4
            }
          }}
        >
          <CardActionArea onClick={() => onSelect(conversation.id)}>
            <CardContent sx={{ pr: onDelete ? 7 : 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {conversation.title}
                  </Typography>
                  {conversation.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        mb: 1
                      }}
                    >
                      {conversation.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    {conversation.messageCount !== undefined && (
                      <Chip
                        label={`${conversation.messageCount} メッセージ`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(conversation.created_at)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </CardActionArea>
          {onDelete && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1
              }}
            >
              <Tooltip title="削除">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => handleDelete(e, conversation.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Card>
      ))}
    </Stack>
  );
}
