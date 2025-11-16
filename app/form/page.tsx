'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  Divider,
  Stack,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DynamicFormField, { FormFieldConfig } from '@/components/form/DynamicFormField';

interface Workflow {
  id: number;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  form_config?: {
    fields: FormFieldConfig[];
  };
}

// 画像データを省略してログ表示用に整形
function sanitizeRequestBody(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeRequestBody(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'data' && typeof value === 'string' && value.length > 100) {
      sanitized[key] = `[BASE64_DATA: ${value.length} bytes]`;
    } else if (key === 'images' && Array.isArray(value)) {
      sanitized[key] = value.map((img: any) => ({
        ...img,
        data: img.data ? `[BASE64_DATA: ${img.data.length} bytes]` : img.data,
      }));
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeRequestBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function FormPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workflowId = searchParams.get('id');

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム値（動的フィールド）
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // 実行結果
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!workflowId) {
      setError('ワークフローIDが指定されていません');
      setLoading(false);
      return;
    }

    loadWorkflow();
  }, [workflowId]);

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/${workflowId}`);
      const data = await response.json();

      if (data.success) {
        setWorkflow(data.workflow);

        // 初期値を設定
        const initialValues: Record<string, any> = {};
        if (data.workflow.form_config?.fields) {
          data.workflow.form_config.fields.forEach((field: FormFieldConfig) => {
            // tagsフィールドは状態を持たないのでスキップ
            if (field.type === 'tags') {
              return;
            }

            if (field.type === 'images') {
              initialValues[field.name] = [];
            } else if (field.type === 'image') {
              initialValues[field.name] = null;
            } else {
              initialValues[field.name] = '';
            }
          });
        }
        setFormValues(initialValues);
      } else {
        setError(data.error || 'ワークフローの読み込みに失敗しました');
      }
    } catch (err: any) {
      setError('ワークフローの読み込み中にエラーが発生しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError(null);
      setResult(null);

      // 入力されたフィールドのみを抽出
      const filledInputs: Record<string, any> = {};
      Object.entries(formValues).forEach(([key, value]) => {
        // 値が存在する場合のみ追加
        if (value !== null && value !== undefined && value !== '' &&
            (!Array.isArray(value) || value.length > 0)) {
          filledInputs[key] = value;
        }
      });

      console.log('========================================');
      console.log('Sending workflow execution request');
      console.log('========================================');
      console.log('Workflow ID:', workflowId);
      console.log('All form values:', formValues);
      console.log('Filled inputs only:', filledInputs);
      console.log('Filled input keys:', Object.keys(filledInputs));
      console.log('========================================');

      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: parseInt(workflowId!),
          inputs: filledInputs, // 入力されたもののみを送信
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        console.error('========================================');
        console.error('Workflow execution failed');
        console.error('========================================');
        console.error('Error:', data.error);
        console.error('Details:', data.details);
        console.error('Error type:', data.errorType);
        console.error('Error code:', data.errorCode);
        console.error('Error cause:', data.errorCause);
        console.error('Stack:', data.stack);
        console.error('Full response:', data);
        console.error('========================================');

        setError(data.details || data.error || 'ワークフローの実行に失敗しました');
      }
    } catch (err: any) {
      console.error('========================================');
      console.error('Workflow execution exception');
      console.error('========================================');
      console.error('Error:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      console.error('========================================');

      setError('ワークフローの実行中にエラーが発生しました: ' + (err.message || ''));
    } finally {
      setExecuting(false);
    }
  };

  const handleFieldChange = async (fieldName: string, value: any) => {
    // 新しいフォーム値を作成
    const newFormValues = {
      ...formValues,
      [fieldName]: value,
    };

    setFormValues(newFormValues);

    // キャラクターシート選択時の自動実行を無効化
    // ユーザーが明示的に「ワークフローを実行」ボタンをクリックしたときのみ実行される
  };

  const executeWithFormValues = async (formValuesToUse: Record<string, any>) => {
    try {
      setExecuting(true);
      setError(null);
      setResult(null);

      // 入力されたフィールドのみを抽出
      const filledInputs: Record<string, any> = {};
      Object.entries(formValuesToUse).forEach(([key, value]) => {
        // 値が存在する場合のみ追加
        if (value !== null && value !== undefined && value !== '' &&
            (!Array.isArray(value) || value.length > 0)) {
          filledInputs[key] = value;
        }
      });

      console.log('========================================');
      console.log('Sending workflow execution request');
      console.log('========================================');
      console.log('Workflow ID:', workflowId);
      console.log('All form values:', formValuesToUse);
      console.log('Filled inputs only:', filledInputs);
      console.log('Filled input keys:', Object.keys(filledInputs));
      console.log('========================================');

      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: parseInt(workflowId!),
          inputs: filledInputs,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        console.error('========================================');
        console.error('Workflow execution failed');
        console.error('========================================');
        console.error('Error:', data.error);
        console.error('Details:', data.details);
        console.error('Error type:', data.errorType);
        console.error('Error code:', data.errorCode);
        console.error('Error cause:', data.errorCause);
        console.error('Stack:', data.stack);
        console.error('Full response:', data);
        console.error('========================================');

        setError(data.details || data.error || 'ワークフローの実行に失敗しました');
      }
    } catch (err: any) {
      console.error('========================================');
      console.error('Workflow execution exception');
      console.error('========================================');
      console.error('Error:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      console.error('========================================');

      setError('ワークフローの実行中にエラーが発生しました: ' + (err.message || ''));
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>ワークフローを読み込んでいます...</Typography>
      </Container>
    );
  }

  if (error && !workflow) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/')}
          sx={{ mt: 2 }}
        >
          ワークフローリストに戻る
        </Button>
      </Container>
    );
  }

  const hasFormConfig = workflow?.form_config?.fields && workflow.form_config.fields.length > 0;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/')}
          sx={{ mb: 2 }}
        >
          ワークフローリストに戻る
        </Button>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {workflow?.name}
        </Typography>
        {workflow?.description && (
          <Typography variant="body1" color="text.secondary">
            {workflow.description}
          </Typography>
        )}
      </Box>

      <Stack spacing={3}>
        {/* 入力フォーム */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            入力
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {hasFormConfig ? (
            // formConfig がある場合：動的フォームを表示
            <Stack spacing={3}>
              {workflow.form_config!.fields.map((field) => (
                <DynamicFormField
                  key={field.name}
                  config={field}
                  value={formValues[field.name]}
                  onChange={(value) => handleFieldChange(field.name, value)}
                  allValues={formValues}
                  onFieldChange={handleFieldChange}
                />
              ))}
            </Stack>
          ) : (
            // formConfig がない場合：入力不要メッセージ
            <Alert severity="info">
              このワークフローには入力が必要ありません。実行ボタンをクリックしてください。
            </Alert>
          )}
        </Paper>

        {/* 実行ボタン */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={executing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
          onClick={handleExecute}
          disabled={executing}
          sx={{
            py: 2,
            fontSize: '1.1rem',
            fontWeight: 600,
          }}
        >
          {executing ? 'ワークフローを実行中...' : 'ワークフローを実行'}
        </Button>

        {/* エラー表示 */}
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* 実行結果 */}
        {result && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="h6" fontWeight={600}>
                実行完了
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={2}>
              {Object.entries(result.outputs).map(([nodeName, output]: [string, any]) => (
                <Card key={nodeName} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip label={output.nodeType} size="small" />
                      <Typography variant="subtitle2" fontWeight={600}>
                        {nodeName}
                      </Typography>
                    </Box>

                    {/* 入力ノードの値を表示 */}
                    {output.nodeType === 'input' && output.output?.value && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          入力値
                        </Typography>
                        <Typography variant="body2">
                          {output.output.value}
                        </Typography>
                      </Box>
                    )}

                    {/* 画像入力ノードの画像を表示 */}
                    {output.nodeType === 'imageInput' && output.output?.imageData && (
                      <CardMedia
                        component="img"
                        image={`data:${output.output.imageData.mimeType};base64,${output.output.imageData.data}`}
                        alt={nodeName}
                        sx={{ maxHeight: 400, objectFit: 'contain', mt: 2, borderRadius: 1 }}
                      />
                    )}

                    {/* AIノードからの画像データ */}
                    {output.output?.imageData && !['imageInput'].includes(output.nodeType) && (
                      <CardMedia
                        component="img"
                        image={`data:${output.output.imageData.mimeType};base64,${output.output.imageData.data}`}
                        alt={nodeName}
                        sx={{ maxHeight: 400, objectFit: 'contain', mt: 2, borderRadius: 1 }}
                      />
                    )}

                    {/* AIノードからの画像URL */}
                    {output.output?.imageUrl && (
                      <CardMedia
                        component="img"
                        image={output.output.imageUrl}
                        alt={nodeName}
                        sx={{ maxHeight: 400, objectFit: 'contain', mt: 2, borderRadius: 1 }}
                      />
                    )}

                    {/* AIノードからのテキスト応答 */}
                    {output.output?.response && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          応答
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {output.output.response}
                        </Typography>
                      </Box>
                    )}

                    {output.output?.videoUrl && (
                      <Box sx={{ mt: 2 }}>
                        <video controls style={{ width: '100%', maxHeight: '400px', borderRadius: '4px' }}>
                          <source src={output.output.videoUrl} />
                        </video>
                      </Box>
                    )}

                    {output.output?.audioData && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          音声
                        </Typography>
                        <audio controls style={{ width: '100%' }}>
                          <source
                            src={
                              typeof output.output.audioData === 'string'
                                ? `data:audio/mpeg;base64,${output.output.audioData}`
                                : `data:${output.output.audioData.mimeType};base64,${output.output.audioData.data}`
                            }
                          />
                        </audio>
                      </Box>
                    )}

                    {output.error && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        {output.error}
                      </Alert>
                    )}

                    {output.requestBody && (
                      <Accordion sx={{ mt: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2" fontWeight={600}>
                            APIリクエスト詳細
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box
                            component="pre"
                            sx={{
                              bgcolor: 'grey.100',
                              p: 2,
                              borderRadius: 1,
                              overflow: 'auto',
                              fontSize: '0.875rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            {JSON.stringify(sanitizeRequestBody(output.requestBody), null, 2)}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}

export default function FormPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>読み込んでいます...</Typography>
        </Container>
      }
    >
      <FormPageContent />
    </Suspense>
  );
}
