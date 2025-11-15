'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  TextField,
  Button,
  Divider,
  Stack,
  Chip,
  MenuItem,
  Alert,
  Paper,
  Snackbar,
  Card,
  CardContent,
  CardMedia,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import UploadIcon from '@mui/icons-material/Upload';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

interface CharacterSheet {
  id: number;
  user_id: string;
  name: string;
  image_url: string;
  description: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface NanobanaNodeSettingsProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdate: (nodeId: string, config: any) => void;
  onDelete: () => void;
}

export default function NanobanaNodeSettings({ node, nodes, edges, onClose, onUpdate, onDelete }: NanobanaNodeSettingsProps) {
  const [name, setName] = useState(node.data.config?.name || '');
  const [description, setDescription] = useState(node.data.config?.description || '');
  const [prompt, setPrompt] = useState(node.data.config?.prompt || '');
  const [aspectRatio, setAspectRatio] = useState(node.data.config?.aspectRatio || '1:1');
  const [referenceImages, setReferenceImages] = useState<Array<{ mimeType: string; data: string }>>(
    node.data.config?.referenceImages || []
  );
  const [selectedCharacterSheetIds, setSelectedCharacterSheetIds] = useState<number[]>(
    node.data.config?.selectedCharacterSheetIds || []
  );
  const [characterSheetsList, setCharacterSheetsList] = useState<CharacterSheet[]>([]);
  const [loadingCharacterSheets, setLoadingCharacterSheets] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 各入力ハンドルへの接続状態を確認
  const connectedInputs = useMemo(() => {
    const connections = {
      prompt: false,
      characters: [] as number[],
      images: [] as number[],
    };

    const incomingEdges = edges.filter(edge => edge.target === node.id);

    incomingEdges.forEach(edge => {
      const handleId = edge.targetHandle;
      if (handleId === 'prompt') {
        connections.prompt = true;
      } else if (handleId?.startsWith('character-')) {
        const index = parseInt(handleId.split('-')[1]);
        connections.characters.push(index);
      } else if (handleId?.startsWith('image-')) {
        const index = parseInt(handleId.split('-')[1]);
        connections.images.push(index);
      }
    });

    return connections;
  }, [edges, node.id]);

  // 上流ノードから引き継ぐ画像を検出
  const incomingImages = useMemo(() => {
    const images: Array<{ nodeName: string; hasImage: boolean }> = [];
    const incomingEdges = edges.filter(edge => edge.target === node.id);

    incomingEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode) {
        const nodeName = sourceNode.data.config?.name || sourceNode.id;
        // 画像を生成・提供するノードタイプをチェック
        const hasImage = sourceNode.data.type === 'imageInput' ||
                        sourceNode.data.type === 'nanobana' ||
                        sourceNode.data.type === 'seedream4' ||
                        (sourceNode.data.config?.imageData && true);
        images.push({ nodeName, hasImage });
      }
    });

    return images;
  }, [nodes, edges, node.id]);

  useEffect(() => {
    loadCharacterSheets();
  }, []);

  useEffect(() => {
    setName(node.data.config?.name || '');
    setDescription(node.data.config?.description || '');
    setPrompt(node.data.config?.prompt || '');
    setAspectRatio(node.data.config?.aspectRatio || '1:1');
    setReferenceImages(node.data.config?.referenceImages || []);
    setSelectedCharacterSheetIds(node.data.config?.selectedCharacterSheetIds || []);
  }, [node]);

  const loadCharacterSheets = async () => {
    try {
      setLoadingCharacterSheets(true);
      const response = await fetch('/api/character-sheets');
      const data = await response.json();

      if (data.success) {
        setCharacterSheetsList(data.characterSheets);
      } else {
        console.error('Failed to load character sheets:', data.error);
      }
    } catch (error) {
      console.error('Failed to load character sheets:', error);
    } finally {
      setLoadingCharacterSheets(false);
    }
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `/api/storage/${imageUrl}`;
  };

  const handleCharacterSheetToggle = (id: number) => {
    setSelectedCharacterSheetIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(csId => csId !== id);
      } else {
        // 最大4つまで
        if (prev.length >= 4) {
          alert('キャラクターシートは最大4つまで選択できます');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: Array<{ mimeType: string; data: string }> = [];

    Array.from(files).forEach((file) => {
      // 画像ファイルのみ受け付ける
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルのみアップロードできます');
        return;
      }

      // ファイルサイズチェック（5MB以下）
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} のサイズが5MBを超えています`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];

        newImages.push({
          mimeType: file.type,
          data: base64Data,
        });

        // 全ての画像の読み込みが完了したら state を更新
        if (newImages.length === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
          setReferenceImages([...referenceImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    console.log('Saving Nanobana node config:', {
      nodeId: node.id,
      name,
      description,
      prompt,
      promptLength: prompt.length,
      aspectRatio,
      referenceImagesCount: referenceImages.length,
    });

    const selectedCharacterSheets = characterSheetsList.filter(cs =>
      selectedCharacterSheetIds.includes(cs.id)
    );

    onUpdate(node.id, {
      name,
      description,
      prompt,
      aspectRatio,
      referenceImages,
      selectedCharacterSheetIds,
      selectedCharacterSheets,
      status: node.data.config?.status || 'idle',
      imageData: node.data.config?.imageData,
      error: node.data.config?.error,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <Drawer
      anchor="right"
      open={true}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: { bgcolor: 'rgba(0, 0, 0, 0.3)' }
        }
      }}
      sx={{
        zIndex: 1300,
        '& .MuiDrawer-paper': {
          width: 450,
          bgcolor: 'background.default',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ImageIcon sx={{ color: '#ff6b9d' }} />
          <Typography variant="h6" fontWeight={600}>
            Nanobana ノード設定
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, overflow: 'auto' }}>
        <Stack spacing={3}>
          {/* Node Info */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードID
            </Typography>
            <TextField
              fullWidth
              value={node.id}
              disabled
              size="small"
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              ノードタイプ
            </Typography>
            <Chip
              label="Nanobana 画像生成"
              sx={{
                bgcolor: 'rgba(255, 107, 157, 0.1)',
                color: '#ff6b9d',
                fontWeight: 500,
              }}
            />
          </Box>

          <Divider />

          {/* Node Configuration */}
          <TextField
            label="名前"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="outlined"
            size="medium"
          />

          <TextField
            label="説明"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            variant="outlined"
          />

          <Divider />

          {/* 入力接続ステータス */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
              入力接続ステータス
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: connectedInputs.prompt ? '#4CAF50' : '#ccc',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  プロンプト: {connectedInputs.prompt ? '接続済み' : '未接続'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: connectedInputs.characters.length > 0 ? '#2196F3' : '#ccc',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  キャラクターシート: {connectedInputs.characters.length} 個接続
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: connectedInputs.images.length > 0 ? '#FF9800' : '#ccc',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  画像: {connectedInputs.images.length} 個接続
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Divider />

          {/* Nanobana Configuration */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            Nanobana 設定
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            Gemini 2.5 Flash Image モデルを使用します。APIキーは環境変数から読み込まれます。
          </Alert>

          <TextField
            label="アスペクト比"
            fullWidth
            select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            variant="outlined"
            helperText="生成する画像のアスペクト比を選択"
          >
            <MenuItem value="1:1">1:1 (正方形)</MenuItem>
            <MenuItem value="16:9">16:9 (横長・ワイド)</MenuItem>
            <MenuItem value="9:16">9:16 (縦長・ポートレート)</MenuItem>
            <MenuItem value="4:3">4:3 (横長・標準)</MenuItem>
            <MenuItem value="3:4">3:4 (縦長・標準)</MenuItem>
            <MenuItem value="3:2">3:2 (横長・写真)</MenuItem>
            <MenuItem value="2:3">2:3 (縦長・写真)</MenuItem>
          </TextField>

          {/* プロンプト入力 - 接続されていない場合のみ表示 */}
          {!connectedInputs.prompt && (
            <Box>
              <TextField
                label="画像生成プロンプト（必須）"
                fullWidth
                multiline
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                variant="outlined"
                placeholder="生成したい画像の説明を入力してください..."
                helperText="プロンプトは英語で記述することを推奨します"
                required
              />
              <Alert severity="info" sx={{ mt: 1, fontSize: '0.8rem' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  前のノードの結果を参照できます：
                </Typography>
                <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  • {`{{prev.response}}`} - 直前のノードの出力<br />
                  • {`{{ノード名.response}}`} - 特定のノードの出力
                </Typography>
              </Alert>
            </Box>
          )}

          {/* プロンプト接続済みの場合 */}
          {connectedInputs.prompt && (
            <Alert severity="success" sx={{ fontSize: '0.875rem' }}>
              プロンプトは接続されたノードから取得されます
            </Alert>
          )}

          <Divider />

          {/* キャラクターシート入力 */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            キャラクターシート（最大4つ）
          </Typography>

          {connectedInputs.characters.length === 0 ? (
            <Box>
              <Alert severity="info" sx={{ fontSize: '0.875rem', mb: 2 }}>
                キャラクターシートマスタから選択してください。選択したキャラクター情報は画像生成に利用されます。
              </Alert>

              {loadingCharacterSheets ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : characterSheetsList.length === 0 ? (
                <Alert severity="warning">
                  キャラクターシートがありません。先にキャラクターシートを作成してください。
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {characterSheetsList.map((sheet) => (
                    <Card
                      key={sheet.id}
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        border: selectedCharacterSheetIds.includes(sheet.id) ? 2 : 1,
                        borderColor: selectedCharacterSheetIds.includes(sheet.id) ? '#2196F3' : 'divider',
                        '&:hover': {
                          boxShadow: 2,
                        },
                      }}
                      onClick={() => handleCharacterSheetToggle(sheet.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedCharacterSheetIds.includes(sheet.id)}
                              onChange={() => handleCharacterSheetToggle(sheet.id)}
                              sx={{
                                color: '#2196F3',
                                '&.Mui-checked': {
                                  color: '#2196F3',
                                },
                              }}
                            />
                          }
                          label=""
                          sx={{ m: 0, mr: 1 }}
                        />
                        <CardMedia
                          component="img"
                          image={getImageUrl(sheet.image_url)}
                          alt={sheet.name}
                          sx={{
                            width: 80,
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 1,
                          }}
                        />
                        <CardContent sx={{ flex: 1, py: 1, '&:last-child': { pb: 1 } }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {sheet.name}
                          </Typography>
                          {sheet.description && (
                            <Typography variant="caption" color="text.secondary">
                              {sheet.description}
                            </Typography>
                          )}
                        </CardContent>
                      </Box>
                    </Card>
                  ))}
                </Stack>
              )}

              {selectedCharacterSheetIds.length > 0 && (
                <Alert severity="success" sx={{ mt: 2, fontSize: '0.875rem' }}>
                  {selectedCharacterSheetIds.length} 個のキャラクターシートを選択中
                </Alert>
              )}
            </Box>
          ) : (
            <Alert severity="success" sx={{ fontSize: '0.875rem' }}>
              {connectedInputs.characters.length} 個のキャラクターシートが接続されています
            </Alert>
          )}

          {/* 画像入力 */}
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            参照画像（最大4つ）
          </Typography>

          {connectedInputs.images.length === 0 ? (
            <Box>
              <Alert severity="info" sx={{ fontSize: '0.875rem', mb: 2 }}>
                参照画像を追加すると、その画像のスタイルや要素を元に画像を生成します。画像サイズは各5MB以下にしてください。
              </Alert>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />

              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={referenceImages.length >= 4}
                sx={{
                  py: 1.5,
                  textTransform: 'none',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: '#FF9800',
                  color: '#FF9800',
                }}
              >
                参照画像を追加 ({referenceImages.length}/4)
              </Button>

              {referenceImages.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {referenceImages.length} 枚の参照画像
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {referenceImages.map((img, index) => (
                      <Box key={index} sx={{ width: 'calc(50% - 8px)' }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            position: 'relative',
                            p: 1,
                            bgcolor: 'action.hover',
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveImage(index)}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              bgcolor: 'background.paper',
                              '&:hover': {
                                bgcolor: 'error.light',
                                color: 'white',
                              },
                            }}
                          >
                            <CloseOutlinedIcon fontSize="small" />
                          </IconButton>
                          <img
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={`Reference ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '120px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                            }}
                          />
                        </Paper>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="success" sx={{ fontSize: '0.875rem' }}>
              {connectedInputs.images.length} 個の画像が接続されています
            </Alert>
          )}

          <Divider />

          {/* Image Display */}
          {node.data.config?.imageData && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                生成された画像
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <img
                  src={`data:${node.data.config.imageData.mimeType};base64,${node.data.config.imageData.data}`}
                  alt="Generated"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                  }}
                />
              </Paper>
            </Box>
          )}

          {/* Error Display */}
          {node.data.config?.status === 'error' && node.data.config?.error && (
            <Alert severity="error">
              {node.data.config.error}
            </Alert>
          )}

          {/* Save Button */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{
              mt: 2,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#ff6b9d',
              '&:hover': {
                bgcolor: '#ff4081',
              },
            }}
          >
            保存
          </Button>

          {/* Delete Button */}
          <Button
            variant="outlined"
            fullWidth
            size="large"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => {
              if (confirm('このノードを削除してもよろしいですか？')) {
                onDelete();
                onClose();
              }
            }}
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            ノードを削除
          </Button>
        </Stack>
      </Box>

      {/* 保存成功のスナックバー */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={2000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          設定を保存しました
        </Alert>
      </Snackbar>
    </Drawer>
  );
}
