'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  LinearProgress,
  Tab,
  Tabs,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

interface EmotionTag {
  id: number;
  name: string;
  name_ja: string | null;
  description: string | null;
  description_ja: string | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`bulk-emotion-tabpanel-${index}`}
      aria-labelledby={`bulk-emotion-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface BulkEmotionSettingsDialogProps {
  open: boolean;
  conversationId: number;
  messageCount: number;
  onClose: () => void;
  onBulkReanalyze: () => Promise<void>;
  onBulkAddTag: (tagName: string) => Promise<void>;
  onBulkRemoveTags: () => Promise<void>;
}

export default function BulkEmotionSettingsDialog({
  open,
  conversationId,
  messageCount,
  onClose,
  onBulkReanalyze,
  onBulkAddTag,
  onBulkRemoveTags,
}: BulkEmotionSettingsDialogProps) {
  const [tabValue, setTabValue] = useState(0);
  const [tags, setTags] = useState<EmotionTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<EmotionTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const response = await fetch('/api/eleven-labs-tags');
        const data = await response.json();

        if (data.success) {
          setTags(data.tags);
          setFilteredTags(data.tags);
        } else {
          console.error('Failed to load tags:', data.error);
        }
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setLoadingTags(false);
      }
    };

    if (open) {
      loadTags();
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTags(tags);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tags.filter((tag) =>
        tag.name.toLowerCase().includes(query) ||
        tag.name_ja?.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query) ||
        tag.description_ja?.toLowerCase().includes(query)
      );
      setFilteredTags(filtered);
    }
  }, [searchQuery, tags]);

  const handleBulkReanalyze = async () => {
    setProcessing(true);
    setProcessMessage('全メッセージの感情タグを再分析中...');
    setError(null);
    setSuccess(null);

    try {
      await onBulkReanalyze();
      setSuccess(`${messageCount}件のメッセージの感情タグを再分析しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '再分析に失敗しました');
    } finally {
      setProcessing(false);
      setProcessMessage('');
    }
  };

  const handleBulkAddTag = async (tagName: string) => {
    setProcessing(true);
    setProcessMessage(`全メッセージに [${tagName}] タグを追加中...`);
    setError(null);
    setSuccess(null);

    try {
      await onBulkAddTag(tagName);
      setSuccess(`${messageCount}件のメッセージに [${tagName}] タグを追加しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タグの追加に失敗しました');
    } finally {
      setProcessing(false);
      setProcessMessage('');
    }
  };

  const handleBulkRemoveTags = async () => {
    if (!confirm('全メッセージから感情タグを削除しますか？')) {
      return;
    }

    setProcessing(true);
    setProcessMessage('全メッセージから感情タグを削除中...');
    setError(null);
    setSuccess(null);

    try {
      await onBulkRemoveTags();
      setSuccess(`${messageCount}件のメッセージから感情タグを削除しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タグの削除に失敗しました');
    } finally {
      setProcessing(false);
      setProcessMessage('');
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleClose = () => {
    if (!processing) {
      onClose();
      setSearchQuery('');
      setTabValue(0);
      setError(null);
      setSuccess(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalOfferIcon color="primary" />
            <Typography variant="h6">感情タグ一括設定</Typography>
            <Chip label={`${messageCount}件`} size="small" color="primary" variant="outlined" />
          </Box>
          <Button
            onClick={handleClose}
            size="small"
            disabled={processing}
            sx={{ minWidth: 'auto', p: 0.5 }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      {processing && (
        <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      )}

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {processing && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<CircularProgress size={20} />}>
            {processMessage}
          </Alert>
        )}

        <Tabs value={tabValue} onChange={handleTabChange} aria-label="bulk emotion settings tabs">
          <Tab
            icon={<AutoFixHighIcon />}
            iconPosition="start"
            label="AI再分析"
            id="bulk-emotion-tab-0"
            aria-controls="bulk-emotion-tabpanel-0"
          />
          <Tab
            icon={<LocalOfferIcon />}
            iconPosition="start"
            label="タグ追加"
            id="bulk-emotion-tab-1"
            aria-controls="bulk-emotion-tabpanel-1"
          />
          <Tab
            icon={<DeleteSweepIcon />}
            iconPosition="start"
            label="タグ削除"
            id="bulk-emotion-tab-2"
            aria-controls="bulk-emotion-tabpanel-2"
          />
        </Tabs>

        <Divider sx={{ mb: 2 }} />

        {/* AI再分析タブ */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AutoFixHighIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              AIによる感情タグ一括再分析
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              会話の文脈を考慮して、各メッセージに最適な感情タグをAIが自動的に判定します。
              <br />
              処理には数十秒〜数分かかる場合があります。
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<AutoFixHighIcon />}
              onClick={handleBulkReanalyze}
              disabled={processing}
            >
              {messageCount}件のメッセージを再分析
            </Button>
          </Box>
        </TabPanel>

        {/* タグ追加タブ */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            選択したタグを全メッセージの先頭に追加します。
            既存の感情タグがある場合は置き換えられます。
          </Typography>

          <TextField
            fullWidth
            placeholder="タグを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ mb: 2 }}
            size="small"
            disabled={processing}
          />

          {loadingTags ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredTags.length === 0 ? (
            <Alert severity="info">
              {searchQuery ? '該当するタグが見つかりませんでした' : '感情タグがありません'}
            </Alert>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: '40vh', overflow: 'auto' }}>
              {filteredTags.map((tag) => (
                <Box
                  key={tag.id}
                  onClick={() => !processing && handleBulkAddTag(tag.name)}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    opacity: processing ? 0.5 : 1,
                    transition: 'all 0.2s',
                    '&:hover': !processing ? {
                      borderColor: 'primary.main',
                      backgroundColor: 'action.hover',
                      boxShadow: 1,
                    } : {},
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={tag.name}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                    />
                    {tag.name_ja && (
                      <Typography variant="body2" fontWeight={600}>
                        {tag.name_ja}
                      </Typography>
                    )}
                    {tag.description_ja && (
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                        {tag.description_ja}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </TabPanel>

        {/* タグ削除タブ */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <DeleteSweepIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              感情タグ一括削除
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              全メッセージから [tag] 形式の感情タグを削除します。
              <br />
              メッセージ本文は維持されます。
            </Typography>
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<DeleteSweepIcon />}
              onClick={handleBulkRemoveTags}
              disabled={processing}
            >
              {messageCount}件のメッセージからタグを削除
            </Button>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="outlined" disabled={processing}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
