'use client';

import { useRouter } from 'next/navigation';
import { Box, Button, Card, CardActions, CardContent, Container, Grid, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, People as PeopleIcon, RecordVoiceOver as VoiceIcon, AutoStories as StoryIcon, Movie as SceneIcon, Forum as ConversationIcon, Chat as MessageIcon, TextSnippet as TextTemplateIcon } from '@mui/icons-material';

const tables = [
  { id: 'characters', title: 'キャラクター', description: 'agents側のキャラクター正本', icon: <PeopleIcon />, color: '#3f51b5' },
  { id: 'character_voice_profiles', title: 'ボイス設定', description: 'キャラごとのTTS voice_prompt / seed / steps', icon: <VoiceIcon />, color: '#7b1fa2' },
  { id: 'stories', title: 'ストーリー', description: 'agents側のストーリー正本', icon: <StoryIcon />, color: '#00897b' },
  { id: 'story_scenes', title: 'シーン', description: 'agents側の物語シーン', icon: <SceneIcon />, color: '#0288d1' },
  { id: 'conversations', title: '会話', description: 'agents側の会話コンテナ', icon: <ConversationIcon />, color: '#ef6c00' },
  { id: 'conversation_messages', title: '会話メッセージ', description: 'agents側のセリフ・発話', icon: <MessageIcon />, color: '#6d4c41' },
  { id: 'text_templates', title: 'テキストテンプレート', description: 'agents側のプロンプト・テキスト雛形', icon: <TextTemplateIcon />, color: '#455a64' },
];

export default function AgentMasterPage() {
  const router = useRouter();
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/master')} sx={{ mb: 2 }}>マスタ管理に戻る</Button>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>Agentsマスタ管理</Typography>
        <Typography variant="body1" color="text.secondary">kazika_studio_agents スキーマを正本として編集します。</Typography>
      </Box>
      <Grid container spacing={3}>
        {tables.map((table) => (
          <Grid size={{ xs: 12, sm: 6, md: 6 }} key={table.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '8px', bgcolor: table.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>{table.icon}</Box>
                  <Typography variant="h6">{table.title}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">{table.description}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontFamily: 'monospace' }}>kazika_studio_agents.{table.id}</Typography>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0 }}><Button fullWidth variant="contained" onClick={() => router.push(`/master/agents/${table.id}`)} sx={{ bgcolor: table.color, '&:hover': { bgcolor: table.color } }}>管理する</Button></CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
