'use client';

import { Container, Typography, Button, Box } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import ConversationPromptTemplateManager from '@/components/master/ConversationPromptTemplateManager';

export default function ConversationPromptTemplatesPage() {
  const router = useRouter();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push('/master')}
        sx={{ mb: 2 }}
      >
        マスタ一覧に戻る
      </Button>

      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          会話生成プロンプトテンプレート管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          会話生成AIに渡すプロンプトテンプレートを管理します。
          テンプレート内では変数（例: {'{'}{'{'} charactersSection {'}'}{'}'}）を使用できます。
        </Typography>
      </Box>

      <ConversationPromptTemplateManager />
    </Container>
  );
}
