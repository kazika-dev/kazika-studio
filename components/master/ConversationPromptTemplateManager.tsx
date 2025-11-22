'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import type { ConversationPromptTemplate } from '@/types/conversation';

export default function ConversationPromptTemplateManager() {
  const [templates, setTemplates] = useState<ConversationPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConversationPromptTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<ConversationPromptTemplate | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/conversation-prompt-templates');
      const result = await response.json();

      if (result.success && result.data?.templates) {
        setTemplates(result.data.templates);
      } else {
        setError('Failed to load templates');
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setTemplateText('');
    setIsDefault(false);
    setDialogOpen(true);
  };

  const handleEdit = (template: ConversationPromptTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setTemplateText(template.template_text);
    setIsDefault(template.is_default);
    setDialogOpen(true);
  };

  const handleView = (template: ConversationPromptTemplate) => {
    setViewingTemplate(template);
    setViewDialogOpen(true);
  };

  const handleCopy = (template: ConversationPromptTemplate) => {
    setEditingTemplate(null);
    setName(`${template.name}のコピー`);
    setDescription(template.description || '');
    setTemplateText(template.template_text);
    setIsDefault(false);
    setDialogOpen(true);
  };

  const handleSetAsDefault = async (templateId: number) => {
    try {
      const response = await fetch(`/api/conversation-prompt-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      const result = await response.json();

      if (result.success) {
        await loadTemplates();
      } else {
        alert(result.error || 'デフォルト設定に失敗しました');
      }
    } catch (err) {
      console.error('Failed to set as default:', err);
      alert('デフォルト設定に失敗しました');
    }
  };

  const handleSave = async () => {
    try {
      if (!name.trim() || !templateText.trim()) {
        alert('名前とテンプレート本文は必須です');
        return;
      }

      const body = {
        name,
        description: description.trim() || undefined,
        templateText,
        isDefault,
      };

      let response;
      if (editingTemplate) {
        response = await fetch(`/api/conversation-prompt-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        response = await fetch('/api/conversation-prompt-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const result = await response.json();

      if (result.success) {
        await loadTemplates();
        setDialogOpen(false);
      } else {
        alert(result.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template');
    }
  };

  const handleDelete = async (template: ConversationPromptTemplate) => {
    if (template.user_id === null) {
      alert('グローバルテンプレートは削除できません');
      return;
    }

    if (!confirm(`テンプレート「${template.name}」を削除しますか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/conversation-prompt-templates/${template.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        await loadTemplates();
      } else {
        alert(result.error || 'Failed to delete template');
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete template');
    }
  };

  if (loading) {
    return <Box>読み込み中...</Box>;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          新規作成
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>使用可能な変数:</strong>
        <br />
        • {'{'}{'{'} charactersSection {'}'}{'}'}  - キャラクター情報セクション
        <br />
        • {'{'}{'{'} situation {'}'}{'}'}  - シチュエーション
        <br />
        • {'{'}{'{'} toneDescription {'}'}{'}'}  - 会話の雰囲気
        <br />
        • {'{'}{'{'} messageCount {'}'}{'}'}  - 生成するメッセージ数
        <br />
        • {'{'}{'{'} previousMessagesSection {'}'}{'}'}  - これまでの会話（あれば）
        <br />
        • {'{'}{'{'} emotionTagsSection {'}'}{'}'}  - 感情タグリスト
        <br />
        • {'{'}{'{'} characterIdsList {'}'}{'}'}  - キャラクターIDのリスト（例: 1, 2, 3）
        <br />
        • {'{'}{'{'} characterNamesList {'}'}{'}'}  - キャラクター名のリスト（例: "ミオ", "カジカ"）
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>名前</TableCell>
              <TableCell>説明</TableCell>
              <TableCell width={120}>デフォルト</TableCell>
              <TableCell width={120}>作成者</TableCell>
              <TableCell width={200}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.name}</TableCell>
                <TableCell>{template.description || '-'}</TableCell>
                <TableCell>
                  {template.is_default ? (
                    <Chip label="デフォルト" color="primary" size="small" />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleSetAsDefault(template.id)}
                    >
                      デフォルトに設定
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {template.user_id === null ? (
                    <Chip label="システム" size="small" />
                  ) : (
                    <Chip label="ユーザー" size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleView(template)}
                    title="プレビュー"
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(template)}
                    title="コピーして新規作成"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  {template.user_id !== null && (
                    <>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(template)}
                        title="編集"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(template)}
                        title="削除"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="名前"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="説明"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="テンプレート本文"
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              fullWidth
              required
              multiline
              rows={20}
              placeholder="{{charactersSection}} などの変数を使用できます"
              sx={{ fontFamily: 'monospace' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
              }
              label="デフォルトテンプレートとして設定"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{viewingTemplate?.name}</DialogTitle>
        <DialogContent>
          {viewingTemplate?.description && (
            <Box sx={{ mb: 2 }}>
              <strong>説明:</strong> {viewingTemplate.description}
            </Box>
          )}
          <Box sx={{ mb: 1 }}>
            <strong>テンプレート本文:</strong>
          </Box>
          <Paper
            sx={{
              p: 2,
              backgroundColor: '#f5f5f5',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              maxHeight: 500,
              overflow: 'auto',
            }}
          >
            {viewingTemplate?.template_text}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
