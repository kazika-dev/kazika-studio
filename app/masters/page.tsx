'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
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
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { toast, Toaster } from 'sonner';

interface MasterItem {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type MasterType = 'eleven-labs-tags' | 'camera-angles' | 'camera-movements' | 'shot-distances';

interface MasterConfig {
  label: string;
  endpoint: string;
  itemKey: string;
}

const MASTER_CONFIGS: Record<MasterType, MasterConfig> = {
  'eleven-labs-tags': {
    label: 'ElevenLabs タグ',
    endpoint: '/api/masters/eleven-labs-tags',
    itemKey: 'tags',
  },
  'camera-angles': {
    label: 'カメラアングル',
    endpoint: '/api/masters/camera-angles',
    itemKey: 'angles',
  },
  'camera-movements': {
    label: 'カメラムーブメント',
    endpoint: '/api/masters/camera-movements',
    itemKey: 'movements',
  },
  'shot-distances': {
    label: 'ショット距離',
    endpoint: '/api/masters/shot-distances',
    itemKey: 'distances',
  },
};

export default function MastersPage() {
  const [activeTab, setActiveTab] = useState<MasterType>('eleven-labs-tags');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadItems();
  }, [activeTab]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const config = MASTER_CONFIGS[activeTab];
      const response = await fetch(config.endpoint);
      const data = await response.json();

      if (data.success) {
        setItems(data[config.itemKey] || []);
      } else {
        toast.error('データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: MasterType) => {
    setActiveTab(newValue);
  };

  const handleOpenDialog = (item?: MasterItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description,
        sort_order: item.sort_order,
        is_active: item.is_active,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        sort_order: 0,
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    try {
      const config = MASTER_CONFIGS[activeTab];
      const url = editingItem
        ? `${config.endpoint}/${editingItem.id}`
        : config.endpoint;
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingItem ? '更新しました' : '作成しました');
        handleCloseDialog();
        loadItems();
      } else {
        toast.error(data.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      toast.error('保存に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;

    try {
      const config = MASTER_CONFIGS[activeTab];
      const response = await fetch(`${config.endpoint}/${editingItem.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('削除しました');
        setDeleteDialogOpen(false);
        setEditingItem(null);
        loadItems();
      } else {
        toast.error('削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('削除に失敗しました');
    }
  };

  const handleOpenDeleteDialog = (item: MasterItem) => {
    setEditingItem(item);
    setDeleteDialogOpen(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Toaster position="top-center" />

      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          マスターデータ管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          各種マスターテーブルのデータを管理します
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          {Object.entries(MASTER_CONFIGS).map(([key, config]) => (
            <Tab key={key} label={config.label} value={key} />
          ))}
        </Tabs>
      </Box>

      <Box mb={2} display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          新規作成
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>説明</TableCell>
                <TableCell align="center">表示順</TableCell>
                <TableCell align="center">有効</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      データがありません
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell align="center">{item.sort_order}</TableCell>
                    <TableCell align="center">
                      {item.is_active ? '○' : '×'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleOpenDeleteDialog(item)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 作成/編集ダイアログ */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem ? 'マスターデータ編集' : 'マスターデータ作成'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="名前"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="説明"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="表示順"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="有効"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSave} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>削除確認</DialogTitle>
        <DialogContent>
          <Typography>
            「{editingItem?.name}」を削除してもよろしいですか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
