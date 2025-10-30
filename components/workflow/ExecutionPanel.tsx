'use client';

import { useState } from 'react';
import { Node, Edge } from 'reactflow';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import { executeWorkflow, ExecutionResult } from '@/lib/workflow/executor';

interface ExecutionPanelProps {
  nodes: Node[];
  edges: Edge[];
  onSave: (name: string, description: string) => Promise<void>;
  currentWorkflowId?: number;
  currentWorkflowName?: string;
}

type NodeStatus = 'idle' | 'running' | 'completed' | 'failed';

export default function ExecutionPanel({ nodes, edges, onSave, currentWorkflowId, currentWorkflowName }: ExecutionPanelProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const [results, setResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setResults(new Map());

    // 実行前にノードの状態をログ出力
    console.log('=== Starting workflow execution ===');
    console.log('Nodes count:', nodes.length);
    nodes.forEach((node) => {
      console.log(`Node ${node.id} (${node.data.type}):`, {
        name: node.data.config?.name,
        prompt: node.data.config?.prompt,
        promptLength: (node.data.config?.prompt || '').length,
      });
    });
    console.log('Edges:', edges);

    // 全ノードをidleに設定
    const initialStatuses = new Map<string, NodeStatus>();
    nodes.forEach((node) => {
      initialStatuses.set(node.id, 'idle');
    });
    setNodeStatuses(initialStatuses);

    try {
      const result = await executeWorkflow(nodes, edges, (nodeId, status) => {
        setNodeStatuses((prev) => {
          const newStatuses = new Map(prev);
          newStatuses.set(nodeId, status);
          return newStatuses;
        });
      });

      setResults(result.results);

      if (!result.success) {
        setError(result.error || 'ワークフローの実行に失敗しました');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStop = () => {
    // TODO: 実行を停止する機能を実装
    setIsExecuting(false);
  };

  const handleSaveClick = () => {
    // すでに保存されている場合は上書き保存
    if (currentWorkflowId && currentWorkflowName) {
      handleSave();
    } else {
      setSaveDialogOpen(true);
    }
  };

  const handleSave = async () => {
    // 上書き保存の場合は現在の名前と説明を使用
    const nameToSave = currentWorkflowId && currentWorkflowName ? currentWorkflowName : workflowName;
    const descToSave = currentWorkflowId && currentWorkflowName ? '' : workflowDescription;

    if (!nameToSave.trim()) {
      setSnackbar({ open: true, message: 'ワークフロー名を入力してください', severity: 'error' });
      return;
    }

    try {
      await onSave(nameToSave, descToSave);
      setSaveDialogOpen(false);
      setWorkflowName('');
      setWorkflowDescription('');
      setSnackbar({ open: true, message: currentWorkflowId ? '上書き保存しました' : '保存しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    }
  };

  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case 'running':
        return <CircularProgress size={16} />;
      case 'completed':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: NodeStatus) => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 10,
          p: 2.5,
          width: 350,
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'auto',
          bgcolor: 'background.paper',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          {currentWorkflowName || 'ワークフロー'}
        </Typography>

        <Stack spacing={2}>
          {/* 保存と実行ボタン */}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSaveClick}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                flex: 1,
              }}
            >
              保存
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={isExecuting ? <StopIcon /> : <PlayArrowIcon />}
              onClick={isExecuting ? handleStop : handleExecute}
              disabled={nodes.length === 0}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                flex: 1,
              }}
            >
              {isExecuting ? '停止' : '実行'}
            </Button>
          </Stack>

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Divider />

        {/* ノード実行状態 */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            実行状態
          </Typography>

          {nodes.length === 0 ? (
            <Alert severity="info">ノードがありません</Alert>
          ) : (
            <Stack spacing={1}>
              {nodes.map((node) => {
                const status = nodeStatuses.get(node.id) || 'idle';
                const result = results.get(node.id);

                return (
                  <Accordion
                    key={node.id}
                    disabled={status === 'idle'}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          width: '100%',
                        }}
                      >
                        {getStatusIcon(status)}
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{ flex: 1 }}
                        >
                          {node.data.config?.name || node.data.label}
                        </Typography>
                        <Chip
                          label={status}
                          size="small"
                          color={getStatusColor(status)}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails>
                      {result?.error && (
                        <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>
                          {result.error}
                        </Alert>
                      )}

                      {result?.success && result.output && (
                        <Box>
                          {/* Nanobanaの画像表示 */}
                          {node.data.type === 'nanobana' &&
                            result.output.imageData && (
                              <Box
                                sx={{
                                  mt: 1,
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  bgcolor: 'action.hover',
                                  p: 1,
                                  display: 'flex',
                                  justifyContent: 'center',
                                }}
                              >
                                <img
                                  src={`data:${result.output.imageData.mimeType};base64,${result.output.imageData.data}`}
                                  alt="Generated"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                  }}
                                />
                              </Box>
                            )}

                          {/* Geminiのテキスト表示 */}
                          {node.data.type === 'gemini' &&
                            result.output.response && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  mt: 1,
                                  bgcolor: 'action.hover',
                                  maxHeight: 200,
                                  overflow: 'auto',
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {result.output.response}
                                </Typography>
                              </Paper>
                            )}

                          {/* その他のノードの出力 */}
                          {node.data.type !== 'nanobana' &&
                            node.data.type !== 'gemini' && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  mt: 1,
                                  bgcolor: 'action.hover',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  component="pre"
                                  sx={{
                                    fontSize: '0.7rem',
                                    fontFamily: 'monospace',
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {JSON.stringify(result.output, null, 2)}
                                </Typography>
                              </Paper>
                            )}
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>

    {/* 保存ダイアログ */}
    <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>ワークフローを保存</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="ワークフロー名"
            fullWidth
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            autoFocus
          />
          <TextField
            label="説明（オプション）"
            fullWidth
            multiline
            rows={3}
            value={workflowDescription}
            onChange={(e) => setWorkflowDescription(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSaveDialogOpen(false)}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>

    {/* スナックバー */}
    <Snackbar
      open={snackbar.open}
      autoHideDuration={3000}
      onClose={() => setSnackbar({ ...snackbar, open: false })}
    >
      <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  </>
  );
}
