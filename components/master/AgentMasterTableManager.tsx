'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Checkbox, Container, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { toast, Toaster } from 'sonner';

type FieldType = 'text' | 'number' | 'boolean' | 'json';
type RecordValue = string | number | boolean | null | Record<string, unknown> | unknown[];
type AgentRecord = Record<string, RecordValue> & { id: number };

interface Props {
  tableKey: string;
  displayName: string;
  description: string;
  fields: Record<string, FieldType>;
}

export default function AgentMasterTableManager({ tableKey, displayName, description, fields }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<AgentRecord | null>(null);
  const [form, setForm] = useState<Record<string, RecordValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [projectKeyFilter, setProjectKeyFilter] = useState('');
  const [genreModeFilter, setGenreModeFilter] = useState('');
  const [productionStatusFilter, setProductionStatusFilter] = useState('');

  const fieldNames = useMemo(() => Object.keys(fields), [fields]);
  const visibleColumns = useMemo(() => ['id', ...fieldNames.slice(0, 6), 'updated_at'].filter((v, i, a) => a.indexOf(v) === i), [fieldNames]);
  const showProjectFilters = tableKey === 'stories' || tableKey === 'story_scenes';
  const filteredRecords = useMemo(() => {
    if (!showProjectFilters) return records;
    return records.filter((record) => {
      const metadata = normalizeMetadata(record.metadata);
      if (projectKeyFilter.trim() && String(metadata.project_key ?? '').toLowerCase() !== projectKeyFilter.trim().toLowerCase()) return false;
      if (genreModeFilter.trim() && String(metadata.genre_mode ?? '').toLowerCase() !== genreModeFilter.trim().toLowerCase()) return false;
      if (productionStatusFilter.trim() && String(metadata.production_status ?? '').toLowerCase() !== productionStatusFilter.trim().toLowerCase()) return false;
      return true;
    });
  }, [genreModeFilter, productionStatusFilter, projectKeyFilter, records, showProjectFilters]);

  useEffect(() => { void load(); }, [tableKey]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/agent-master-tables/${tableKey}?limit=300`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '取得に失敗しました');
      setRecords(result.data?.records || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '取得に失敗しました';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function emptyValue(type: FieldType): RecordValue {
    if (type === 'boolean') return false;
    if (type === 'json') return {};
    return '';
  }

  function openCreate() {
    const next: Record<string, RecordValue> = {};
    for (const field of fieldNames) next[field] = emptyValue(fields[field]);
    setSelected(null);
    setForm(next);
    setOpen(true);
  }

  function openEdit(record: AgentRecord) {
    const next: Record<string, RecordValue> = {};
    for (const field of fieldNames) next[field] = record[field] ?? emptyValue(fields[field]);
    setSelected(record);
    setForm(next);
    setOpen(true);
  }

  function setField(field: string, value: RecordValue) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function jsonText(value: RecordValue) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value ?? {}, null, 2);
  }

  function coerceForm() {
    const body: Record<string, unknown> = selected ? { id: selected.id } : {};
    for (const field of fieldNames) {
      const type = fields[field];
      const value = form[field];
      if (type === 'json') {
        try {
          body[field] = typeof value === 'string' ? JSON.parse(value || '{}') : value ?? {};
        } catch {
          throw new Error(`${field} のJSONが不正です`);
        }
      } else if (type === 'number') {
        body[field] = value === '' || value === null ? null : Number(value);
      } else {
        body[field] = value;
      }
    }
    return body;
  }

  async function save() {
    setSubmitting(true);
    try {
      const body = coerceForm();
      const response = await fetch(`/api/agent-master-tables/${tableKey}`, {
        method: selected ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '保存に失敗しました');
      toast.success(selected ? '更新しました' : '作成しました');
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/agent-master-tables/${tableKey}?id=${selected.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '削除に失敗しました');
      toast.success('削除しました');
      setDeleteOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Toaster position="top-center" />
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/master/agents')} sx={{ mb: 2 }}>Agentsマスタに戻る</Button>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>{displayName}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>kazika_studio_agents.{tableKey}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>新規追加</Button>
      </Box>
      {showProjectFilters && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={2} flexWrap="wrap">
            <Box>
              <Typography variant="subtitle2">作品フィルタ</Typography>
              <Typography variant="caption" color="text.secondary">metadata.project_key / genre_mode / production_status で絞り込み</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">表示 {filteredRecords.length} / {records.length}</Typography>
          </Box>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2}>
            <TextField size="small" label="project_key" value={projectKeyFilter} onChange={(e) => setProjectKeyFilter(e.target.value)} placeholder="例: romcom01" />
            <TextField size="small" label="genre_mode" value={genreModeFilter} onChange={(e) => setGenreModeFilter(e.target.value)} placeholder="romcom / narou" />
            <TextField size="small" label="production_status" value={productionStatusFilter} onChange={(e) => setProductionStatusFilter(e.target.value)} placeholder="idea / outline / script" />
          </Box>
        </Paper>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow>{visibleColumns.map((col) => <TableCell key={col}>{col}</TableCell>)}<TableCell align="right">操作</TableCell></TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={visibleColumns.length + 1}>読み込み中...</TableCell></TableRow> : filteredRecords.map((record) => (
              <TableRow key={record.id} hover>
                {visibleColumns.map((col) => <TableCell key={col} sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatCell(record[col])}</TableCell>)}
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(record)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { setSelected(record); setDeleteOpen(true); }}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{selected ? '編集' : '新規追加'}: {displayName}</DialogTitle>
        <DialogContent dividers>
          <Box display="grid" gap={2} sx={{ mt: 1 }}>
            {fieldNames.map((field) => {
              const type = fields[field];
              if (type === 'boolean') return <Box key={field} display="flex" alignItems="center" gap={1}><Checkbox checked={Boolean(form[field])} onChange={(e) => setField(field, e.target.checked)} /> <Typography>{field}</Typography></Box>;
              if (type === 'json') return <TextField key={field} label={field} value={jsonText(form[field])} onChange={(e) => setField(field, e.target.value)} multiline minRows={4} fullWidth />;
              return <TextField key={field} label={field} type={type === 'number' ? 'number' : 'text'} value={String(form[field] ?? '')} onChange={(e) => setField(field, e.target.value)} multiline={type === 'text' && ['description', 'personality', 'speaking_style', 'looks', 'voice_prompt', 'draft', 'message_text', 'summary'].includes(field)} minRows={3} fullWidth />;
            })}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>キャンセル</Button><Button variant="contained" onClick={save} disabled={submitting}>保存</Button></DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}><DialogTitle>削除確認</DialogTitle><DialogContent>#{selected?.id} を削除しますか？</DialogContent><DialogActions><Button onClick={() => setDeleteOpen(false)}>キャンセル</Button><Button color="error" variant="contained" onClick={remove} disabled={submitting}>削除</Button></DialogActions></Dialog>
    </Container>
  );
}

function normalizeMetadata(value: RecordValue): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function formatCell(value: RecordValue) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
