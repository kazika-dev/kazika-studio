'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

interface ApiKey {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // API キー一覧を取得
  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      const data = await response.json();

      if (data.success) {
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      showSnackbar('API キーの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  // API キーを作成
  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      showSnackbar('名前を入力してください', 'error');
      return;
    }

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await response.json();

      if (data.success) {
        setCreatedApiKey(data.apiKey);
        setShowCreatedKey(true);
        setNewKeyName('');
        fetchApiKeys();
        showSnackbar('API キーを作成しました', 'success');
      } else {
        showSnackbar('API キーの作成に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      showSnackbar('API キーの作成に失敗しました', 'error');
    }
  };

  // API キーを削除
  const handleDeleteApiKey = async () => {
    if (!selectedKey) return;

    try {
      const response = await fetch(`/api/api-keys?id=${selectedKey.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchApiKeys();
        showSnackbar('API キーを削除しました', 'success');
      } else {
        showSnackbar('API キーの削除に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      showSnackbar('API キーの削除に失敗しました', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedKey(null);
    }
  };

  // クリップボードにコピー
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSnackbar('クリップボードにコピーしました', 'success');
  };

  // スナックバー表示
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  // 日時フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          API キー管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          新しいキーを作成
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            API キーを使用すると、Chrome Extension などの外部アプリケーションから kazika-studio の API にアクセスできます。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ⚠️ API キーは1回のみ表示されます。安全な場所に保管してください。
          </Typography>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>名前</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>作成日時</TableCell>
              <TableCell>最終使用日時</TableCell>
              <TableCell>有効期限</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : apiKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  API キーがありません
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={key.is_active ? '有効' : '無効'}
                      color={key.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(key.created_at)}</TableCell>
                  <TableCell>{formatDate(key.last_used_at)}</TableCell>
                  <TableCell>{formatDate(key.expires_at)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedKey(key);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* API キー作成ダイアログ */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新しい API キーを作成</DialogTitle>
        <DialogContent>
          {createdApiKey ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                このキーは1回のみ表示されます。安全な場所に保管してください。
              </Alert>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  fullWidth
                  label="API キー"
                  value={createdApiKey}
                  type={showCreatedKey ? 'text' : 'password'}
                  InputProps={{ readOnly: true }}
                />
                <IconButton onClick={() => setShowCreatedKey(!showCreatedKey)}>
                  {showCreatedKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
                <IconButton onClick={() => handleCopyToClipboard(createdApiKey)}>
                  <CopyIcon />
                </IconButton>
              </Box>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <DialogContentText sx={{ mb: 2 }}>
                API キーの用途を識別するための名前を入力してください（例: Chrome Extension）
              </DialogContentText>
              <TextField
                fullWidth
                label="名前"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setCreatedApiKey(null);
              setNewKeyName('');
            }}
          >
            {createdApiKey ? '閉じる' : 'キャンセル'}
          </Button>
          {!createdApiKey && (
            <Button variant="contained" onClick={handleCreateApiKey}>
              作成
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>API キーを削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            「{selectedKey?.name}」を削除してもよろしいですか？
            <br />
            この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" color="error" onClick={handleDeleteApiKey}>
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}
