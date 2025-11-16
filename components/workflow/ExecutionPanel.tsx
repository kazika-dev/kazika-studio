'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
  IconButton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import type { ExecutionResult } from '@/lib/workflow/types';
import { topologicalSort } from '@/lib/workflow/types';
import FindInLogsToolbar from './FindInLogsToolbar';
import { highlightText, countMatches } from '@/lib/utils/highlightText';

interface ExecutionPanelProps {
  nodes: Node[];
  edges: Edge[];
  onSave: (name: string, description: string) => Promise<void>;
  currentWorkflowId?: number;
  currentWorkflowName?: string;
  onWorkflowNameChange?: (name: string) => void;
}

type NodeStatus = 'idle' | 'running' | 'completed' | 'failed';

export default function ExecutionPanel({ nodes, edges, onSave, currentWorkflowId, currentWorkflowName, onWorkflowNameChange }: ExecutionPanelProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const [results, setResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState('');

  // ログ内検索機能の状態
  const panelRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  // ノードを実行順序でソート
  const sortedNodes = useMemo(() => {
    try {
      if (nodes.length === 0) return [];
      const executionOrder = topologicalSort(nodes, edges);
      return executionOrder
        .map(nodeId => nodes.find(n => n.id === nodeId))
        .filter((node): node is Node => node !== undefined);
    } catch (error) {
      // 循環参照などのエラーがある場合は元の順序を返す
      console.error('Failed to sort nodes:', error);
      return nodes;
    }
  }, [nodes, edges]);

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setResults(new Map());
    setExpandedNodes(new Set());

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
      // API経由でワークフローを実行
      const response = await fetch('/api/workflows/execute-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodes,
          edges,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || data.details || 'ワークフローの実行に失敗しました');
        return;
      }

      // API レスポンスから結果を復元
      const resultsMap = new Map<string, ExecutionResult>();

      Object.entries(data.outputs || {}).forEach(([nodeName, output]: [string, any]) => {
        const nodeId = output.nodeId;
        resultsMap.set(nodeId, {
          nodeId: nodeId,
          success: output.success,
          output: output.output,
          error: output.error,
          requestBody: output.requestBody,
        });

        // 各ノードの状態を更新
        setNodeStatuses((prev) => {
          const newStatuses = new Map(prev);
          newStatuses.set(nodeId, output.success ? 'completed' : 'failed');
          return newStatuses;
        });

        // 完了したノードを自動的に展開
        setExpandedNodes((prev) => {
          const newExpanded = new Set(prev);
          newExpanded.add(nodeId);
          return newExpanded;
        });
      });

      setResults(resultsMap);

      // ワークフロー実行成功後、アウトプットをDBに保存
      if (currentWorkflowId) {
        await saveOutputsToDatabase(resultsMap, currentWorkflowId);
      }

    } catch (error: any) {
      console.error('Failed to execute workflow:', error);
      setError(error.message || 'ワークフローの実行中にエラーが発生しました');
    } finally {
      setIsExecuting(false);
    }
  };

  // アウトプットをDBに保存する関数（最後のノードの出力のみ）
  const saveOutputsToDatabase = async (results: Map<string, ExecutionResult>, workflowId?: number) => {
    console.log('Saving final output to database...');

    // 実行順序を取得して最後のノードを特定
    let executionOrder: string[];
    try {
      executionOrder = topologicalSort(nodes, edges);
    } catch (error) {
      console.error('Failed to get execution order:', error);
      return;
    }

    if (executionOrder.length === 0) {
      console.log('No nodes to save');
      return;
    }

    // 最後のノードIDを取得
    const lastNodeId = executionOrder[executionOrder.length - 1];
    const result = results.get(lastNodeId);

    if (!result || !result.success || !result.output) {
      console.log('No valid output from final node');
      return;
    }

    const node = nodes.find(n => n.id === lastNodeId);
    if (!node) {
      console.error('Final node not found');
      return;
    }

    console.log(`Saving output from final node: ${node.data.config?.name || node.data.label} (${node.data.type})`);

    try {
      // Nanobanaノードの画像を保存（GCP Storage内部パスを使用）
      if (node.data.type === 'nanobana' && result.output.storagePath) {
        const response = await fetch('/api/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflowId,
            outputType: 'image',
            content: {
              path: result.output.storagePath, // GCP Storage内部パス
            },
            prompt: result.requestBody?.prompt || '',
            metadata: {
              nodeId: lastNodeId,
              nodeName: node.data.config?.name || node.data.label,
              aspectRatio: result.requestBody?.aspectRatio,
              model: 'gemini-2.5-flash-image',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Saved final output:`, data);
        } else {
          console.error(`Failed to save final output:`, await response.text());
        }
      }

      // Geminiノードのテキストを保存
      else if (node.data.type === 'gemini' && result.output.response) {
        const response = await fetch('/api/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflowId,
            outputType: 'text',
            content: result.output.response,
            prompt: result.requestBody?.prompt || '',
            metadata: {
              nodeId: lastNodeId,
              nodeName: node.data.config?.name || node.data.label,
              model: result.requestBody?.model || 'gemini-2.5-flash',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Saved final output:`, data);
        } else {
          console.error(`Failed to save final output:`, await response.text());
        }
      }

      // ElevenLabsノードの音声を保存
      else if (node.data.type === 'elevenlabs' && result.output.audioData) {
        const response = await fetch('/api/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflowId,
            outputType: 'audio',
            content: {
              base64: result.output.audioData.data, // 'data' key from API response
              mimeType: result.output.audioData.mimeType,
            },
            prompt: result.requestBody?.text || '',
            metadata: {
              nodeId: lastNodeId,
              nodeName: node.data.config?.name || node.data.label,
              voiceId: result.requestBody?.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
              modelId: result.requestBody?.modelId || 'eleven_multilingual_v2',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Saved final output:`, data);
        } else {
          console.error(`Failed to save final output:`, await response.text());
        }
      }

      // Seedream4ノードの画像を保存
      else if (node.data.type === 'seedream4' && result.output.imageUrl) {
        const response = await fetch('/api/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflowId,
            outputType: 'image',
            content: {
              url: result.output.imageUrl, // Seedream4 returns a URL
            },
            prompt: result.requestBody?.prompt || '',
            metadata: {
              nodeId: lastNodeId,
              nodeName: node.data.config?.name || node.data.label,
              jobId: result.output.jobId,
              aspectRatio: result.requestBody?.aspectRatio || '4:3',
              quality: result.requestBody?.quality || 'basic',
              model: 'seedream4',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Saved final output:`, data);
        } else {
          console.error(`Failed to save final output:`, await response.text());
        }
      }

      // Higgsfieldノードの動画を保存
      else if (node.data.type === 'higgsfield' && result.output.videoUrl) {
        const response = await fetch('/api/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflowId,
            outputType: 'video',
            content: {
              url: result.output.videoUrl, // Higgsfield returns a URL
            },
            prompt: result.requestBody?.prompt || '',
            metadata: {
              nodeId: lastNodeId,
              nodeName: node.data.config?.name || node.data.label,
              jobId: result.output.jobId,
              duration: result.output.duration || 5,
              cfgScale: result.requestBody?.cfgScale || 0.5,
              enhancePrompt: result.requestBody?.enhancePrompt || false,
              model: 'kling-v2-5-turbo',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Saved final output:`, data);
        } else {
          console.error(`Failed to save final output:`, await response.text());
        }
      }

      // その他のノード（output、processなど）
      else if (result.output) {
        // JSONとして保存
        const response = await fetch('/api/outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflowId,
            outputType: 'json',
            content: '', // content_textは不要
            prompt: '',
            metadata: {
              nodeId: lastNodeId,
              nodeName: node.data.config?.name || node.data.label,
              nodeType: node.data.type,
              output: result.output,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Saved final output:`, data);
        } else {
          console.error(`Failed to save final output:`, await response.text());
        }
      }
    } catch (error) {
      console.error(`Error saving final output:`, error);
      // エラーが発生してもワークフロー実行は成功としておく
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

  const handleEditNameClick = () => {
    setEditingName(currentWorkflowName || '');
    setEditNameDialogOpen(true);
  };

  const handleEditNameSave = async () => {
    if (!editingName.trim()) {
      setSnackbar({ open: true, message: 'ワークフロー名を入力してください', severity: 'error' });
      return;
    }

    try {
      await onSave(editingName, '');
      if (onWorkflowNameChange) {
        onWorkflowNameChange(editingName);
      }
      setEditNameDialogOpen(false);
      setSnackbar({ open: true, message: 'ワークフロー名を変更しました', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '名前の変更に失敗しました', severity: 'error' });
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

  // Ctrl+F / Cmd+F キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        const target = event.target as HTMLElement;
        // パネル内でのみCtrl+Fを有効化
        if (panelRef.current && panelRef.current.contains(target)) {
          event.preventDefault();
          setIsSearchOpen(true);
        }
      }
      if (event.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // 検索クエリが変わったら、マッチ数を再計算
  useEffect(() => {
    if (!searchQuery || !panelRef.current) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    // パネル内の全テキストを取得してマッチ数をカウント
    const textContent = panelRef.current.innerText || '';
    const matches = countMatches(textContent, searchQuery);
    setTotalMatches(matches);
    setCurrentMatchIndex(0);
  }, [searchQuery, results]);

  // 次のマッチに移動
  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  };

  // 前のマッチに移動
  const handlePreviousMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  };

  // テキストをハイライト表示（検索クエリがある場合のみ）
  const renderHighlightedText = (text: string) => {
    if (!searchQuery) {
      return text;
    }
    return highlightText(text, searchQuery, currentMatchIndex);
  };

  return (
    <>
      <Paper
        ref={panelRef}
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
        {/* ログ内検索ツールバー */}
        <FindInLogsToolbar
          isOpen={isSearchOpen}
          searchQuery={searchQuery}
          currentMatchIndex={currentMatchIndex}
          totalMatches={totalMatches}
          onSearchChange={setSearchQuery}
          onClose={() => {
            setIsSearchOpen(false);
            setSearchQuery('');
          }}
          onNext={handleNextMatch}
          onPrevious={handlePreviousMatch}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
            {currentWorkflowName || 'ワークフロー'}
          </Typography>
          {currentWorkflowId && (
            <IconButton
              size="small"
              onClick={handleEditNameClick}
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

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

          {sortedNodes.length === 0 ? (
            <Alert severity="info">ノードがありません</Alert>
          ) : (
            <Stack spacing={1}>
              {sortedNodes.map((node, index) => {
                const status = nodeStatuses.get(node.id) || 'idle';
                const result = results.get(node.id);
                const isExpanded = expandedNodes.has(node.id);

                return (
                  <Accordion
                    key={node.id}
                    disabled={status === 'idle'}
                    expanded={isExpanded}
                    onChange={(_, expanded) => {
                      setExpandedNodes((prev) => {
                        const newExpanded = new Set(prev);
                        if (expanded) {
                          newExpanded.add(node.id);
                        } else {
                          newExpanded.delete(node.id);
                        }
                        return newExpanded;
                      });
                    }}
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
                        <Chip
                          label={index + 1}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: 'action.selected',
                            minWidth: '28px',
                          }}
                        />
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
                      {/* 入力値セクション */}
                      {result?.input && Object.keys(result.input).length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                            入力値
                          </Typography>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              bgcolor: 'action.hover',
                              maxHeight: 150,
                              overflow: 'auto',
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
                              {renderHighlightedText(JSON.stringify(result.input, null, 2))}
                            </Typography>
                          </Paper>
                        </Box>
                      )}

                      {/* APIリクエストボディセクション */}
                      {result?.requestBody && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                            APIリクエスト
                          </Typography>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              bgcolor: 'info.lighter',
                              maxHeight: 150,
                              overflow: 'auto',
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
                              {renderHighlightedText(JSON.stringify(result.requestBody, null, 2))}
                            </Typography>
                          </Paper>
                        </Box>
                      )}

                      {/* エラー表示 */}
                      {result?.error && (
                        <Box sx={{ mb: 2 }}>
                          <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
                            <Typography variant="body2" fontWeight={600} sx={{ mb: result.errorDetails ? 1 : 0 }}>
                              {result.error}
                            </Typography>
                            {result.errorDetails && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  mt: 1,
                                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                                  maxHeight: 200,
                                  overflow: 'auto',
                                }}
                              >
                                <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                                  エラー詳細:
                                </Typography>
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
                                  {renderHighlightedText(JSON.stringify(result.errorDetails, null, 2))}
                                </Typography>
                              </Paper>
                            )}
                          </Alert>
                        </Box>
                      )}

                      {/* 出力値セクション */}
                      {result?.output && (
                        <Box>
                          <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                            出力値
                          </Typography>
                          {/* Nanobanaの画像表示 */}
                          {node.data.type === 'nanobana' &&
                            result.output.imageData && (
                              <>
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
                                {/* GCP Storage Path表示 */}
                                {result.output.storagePath && (
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 1.5,
                                      mt: 1,
                                      bgcolor: 'success.lighter',
                                    }}
                                  >
                                    <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                                      GCP Storage Path
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.7rem',
                                        fontFamily: 'monospace',
                                        color: 'text.secondary',
                                        wordBreak: 'break-all',
                                      }}
                                    >
                                      {result.output.storagePath}
                                    </Typography>
                                  </Paper>
                                )}
                              </>
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
                                  {renderHighlightedText(result.output.response)}
                                </Typography>
                              </Paper>
                            )}

                          {/* ElevenLabsの音声表示 */}
                          {node.data.type === 'elevenlabs' &&
                            result.output.audioData && (
                              <Box
                                sx={{
                                  mt: 1,
                                  p: 1.5,
                                  bgcolor: 'action.hover',
                                  borderRadius: 1,
                                }}
                              >
                                <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                                  生成された音声
                                </Typography>
                                <audio
                                  controls
                                  style={{ width: '100%' }}
                                  src={`data:${result.output.audioData.mimeType};base64,${result.output.audioData.data}`}
                                />
                              </Box>
                            )}

                          {/* Seedream4の画像表示 */}
                          {node.data.type === 'seedream4' && (
                            <Box
                              sx={{
                                mt: 1,
                                p: 1.5,
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                              }}
                            >
                              {result.output.imageUrl ? (
                                <>
                                  <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                                    生成された画像
                                  </Typography>
                                  <Box sx={{ textAlign: 'center' }}>
                                    <img
                                      style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px' }}
                                      src={result.output.imageUrl}
                                      alt="Generated"
                                    />
                                  </Box>
                                  {result.output.jobId && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        mt: 1,
                                        fontSize: '0.65rem',
                                        fontFamily: 'monospace',
                                        color: 'text.secondary',
                                      }}
                                    >
                                      Job ID: {result.output.jobId}
                                    </Typography>
                                  )}
                                </>
                              ) : result.output.status === 'processing' ? (
                                <>
                                  <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                                    画像生成中
                                  </Typography>
                                  <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
                                    {result.output.message}
                                  </Alert>
                                  {result.output.jobId && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
                                        Job Set ID: {result.output.jobSetId}
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
                                        Job ID: {result.output.jobId}
                                      </Typography>
                                      {result.output.dashboardUrl && (
                                        <Button
                                          size="small"
                                          href={result.output.dashboardUrl}
                                          target="_blank"
                                          sx={{ mt: 1, fontSize: '0.7rem' }}
                                        >
                                          ダッシュボードで確認
                                        </Button>
                                      )}
                                    </Box>
                                  )}
                                  {result.output.note && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        mt: 1,
                                        fontSize: '0.65rem',
                                        color: 'text.secondary',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      {result.output.note}
                                    </Typography>
                                  )}
                                </>
                              ) : null}
                            </Box>
                          )}

                          {/* Higgsfieldの動画表示 */}
                          {node.data.type === 'higgsfield' && (
                            <Box
                              sx={{
                                mt: 1,
                                p: 1.5,
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                              }}
                            >
                              {result.output.videoUrl ? (
                                <>
                                  <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                                    生成された動画
                                  </Typography>
                                  <video
                                    controls
                                    style={{ width: '100%', maxHeight: '400px', borderRadius: '4px' }}
                                    src={result.output.videoUrl}
                                  />
                                  {result.output.jobId && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        mt: 1,
                                        fontSize: '0.65rem',
                                        fontFamily: 'monospace',
                                        color: 'text.secondary',
                                      }}
                                    >
                                      Job ID: {result.output.jobId}
                                    </Typography>
                                  )}
                                </>
                              ) : result.output.status === 'processing' ? (
                                <>
                                  <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                                    動画生成中
                                  </Typography>
                                  <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
                                    {result.output.message}
                                  </Alert>
                                  {result.output.jobId && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
                                        Job Set ID: {result.output.jobSetId}
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
                                        Job ID: {result.output.jobId}
                                      </Typography>
                                      {result.output.dashboardUrl && (
                                        <Button
                                          size="small"
                                          href={result.output.dashboardUrl}
                                          target="_blank"
                                          sx={{ mt: 1, fontSize: '0.7rem' }}
                                        >
                                          ダッシュボードで確認
                                        </Button>
                                      )}
                                    </Box>
                                  )}
                                  {result.output.note && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        mt: 1,
                                        fontSize: '0.65rem',
                                        color: 'text.secondary',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      {result.output.note}
                                    </Typography>
                                  )}
                                </>
                              ) : null}
                            </Box>
                          )}

                          {/* その他のノードの出力 */}
                          {node.data.type !== 'nanobana' &&
                            node.data.type !== 'gemini' &&
                            node.data.type !== 'elevenlabs' &&
                            node.data.type !== 'higgsfield' &&
                            node.data.type !== 'seedream4' && (
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
                                  {renderHighlightedText(JSON.stringify(result.output, null, 2))}
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

    {/* ワークフロー名編集ダイアログ */}
    <Dialog open={editNameDialogOpen} onClose={() => setEditNameDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>ワークフロー名を変更</DialogTitle>
      <DialogContent>
        <TextField
          label="ワークフロー名"
          fullWidth
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditNameDialogOpen(false)}>キャンセル</Button>
        <Button onClick={handleEditNameSave} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  </>
  );
}
