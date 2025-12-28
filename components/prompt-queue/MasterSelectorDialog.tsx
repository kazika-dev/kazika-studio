'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  CameraAlt as CameraIcon,
  Videocam as VideoIcon,
  PhotoSizeSelectActual as ShotIcon,
  TextSnippet as TextIcon,
} from '@mui/icons-material';

interface MasterRecord {
  id: number;
  name: string;
  name_ja: string;
  description?: string;
  description_ja?: string;
  category?: string;
  content?: string;
}

interface MasterSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
}

type MasterTableType = 'm_camera_angles' | 'm_camera_movements' | 'm_shot_distances' | 'm_text_templates';

const MASTER_TABLES: { value: MasterTableType; label: string; icon: React.ReactElement }[] = [
  { value: 'm_camera_angles', label: 'カメラアングル', icon: <CameraIcon /> },
  { value: 'm_camera_movements', label: 'カメラ動き', icon: <VideoIcon /> },
  { value: 'm_shot_distances', label: 'ショット距離', icon: <ShotIcon /> },
  { value: 'm_text_templates', label: 'テンプレート', icon: <TextIcon /> },
];

export default function MasterSelectorDialog({
  open,
  onClose,
  onSelect,
}: MasterSelectorDialogProps) {
  const [tabValue, setTabValue] = useState<MasterTableType>('m_camera_angles');
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MasterRecord | null>(null);

  // タブが変わったときにデータを取得
  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedRecord(null);
      setSearchQuery('');
    }
  }, [open, tabValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/master-tables/${tabValue}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch master data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedRecord) {
      // m_text_templatesの場合はcontent、その他はname_jaまたはnameを使用
      const text = tabValue === 'm_text_templates' && selectedRecord.content
        ? selectedRecord.content
        : selectedRecord.name_ja || selectedRecord.name;
      onSelect(text);
      onClose();
    }
  };

  // 検索フィルタリング
  const filteredRecords = records.filter((record) => {
    const query = searchQuery.toLowerCase();
    return (
      record.name.toLowerCase().includes(query) ||
      record.name_ja?.toLowerCase().includes(query) ||
      record.description?.toLowerCase().includes(query) ||
      record.description_ja?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6">マスターデータから選択</Typography>
      </DialogTitle>
      <DialogContent>
        <Tabs
          value={tabValue}
          onChange={(_, value) => setTabValue(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {MASTER_TABLES.map((table) => (
            <Tab
              key={table.value}
              value={table.value}
              label={table.label}
              icon={table.icon}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>

        <TextField
          fullWidth
          size="small"
          placeholder="検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredRecords.length > 0 ? (
              <List dense>
                {filteredRecords.map((record) => (
                  <ListItemButton
                    key={record.id}
                    selected={selectedRecord?.id === record.id}
                    onClick={() => setSelectedRecord(record)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      border: selectedRecord?.id === record.id ? '2px solid #1976d2' : '1px solid #eee',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {record.name_ja || record.name}
                          </Typography>
                          {record.category && (
                            <Chip size="small" label={record.category} variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          {record.name_ja && record.name !== record.name_ja && (
                            <Typography variant="caption" color="text.secondary" component="span">
                              {record.name}
                            </Typography>
                          )}
                          {record.description_ja || record.description ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {record.description_ja || record.description}
                            </Typography>
                          ) : null}
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={4}>
                データがありません
              </Typography>
            )}
          </Box>
        )}

        {/* プレビュー */}
        {selectedRecord && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1, maxHeight: 150, overflow: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              挿入するテキスト:
            </Typography>
            <Typography
              variant="body1"
              fontWeight="medium"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {tabValue === 'm_text_templates' && selectedRecord.content
                ? selectedRecord.content
                : selectedRecord.name_ja || selectedRecord.name}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selectedRecord}
        >
          挿入
        </Button>
      </DialogActions>
    </Dialog>
  );
}
