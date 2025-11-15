'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Grid,
  Typography,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  VideoSettings as VideoSettingsIcon,
  ZoomOutMap as ZoomOutMapIcon,
  Label as LabelIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

interface MasterTable {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const masterTables: MasterTable[] = [
  {
    id: 'eleven_labs_tags',
    name: 'eleven_labs_tags',
    displayName: 'ElevenLabs タグ',
    description: 'ElevenLabs 音声生成用のタグマスタデータ',
    icon: <LabelIcon />,
    color: '#9c27b0',
  },
  {
    id: 'm_camera_angles',
    name: 'm_camera_angles',
    displayName: 'カメラアングル',
    description: 'カメラアングルのマスタデータ（ハイアングル、ローアングルなど）',
    icon: <PhotoCameraIcon />,
    color: '#1976d2',
  },
  {
    id: 'm_camera_movements',
    name: 'm_camera_movements',
    displayName: 'カメラムーブメント',
    description: 'カメラの動きのマスタデータ（パン、ティルト、ズームなど）',
    icon: <VideoSettingsIcon />,
    color: '#2e7d32',
  },
  {
    id: 'm_shot_distances',
    name: 'm_shot_distances',
    displayName: 'ショット距離',
    description: 'ショット距離のマスタデータ（クローズアップ、ロングショットなど）',
    icon: <ZoomOutMapIcon />,
    color: '#ed6c02',
  },
];

export default function MasterPage() {
  const router = useRouter();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push('/')}
        sx={{ mb: 2 }}
      >
        ホームに戻る
      </Button>

      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          マスタデータ管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          システムで使用するマスタデータの管理を行います。
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {masterTables.map((table) => (
          <Grid size={{ xs: 12, sm: 6, md: 6 }} key={table.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '8px',
                      backgroundColor: table.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      mr: 2,
                    }}
                  >
                    {table.icon}
                  </Box>
                  <Typography variant="h6" component="h2">
                    {table.displayName}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {table.description}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block', fontFamily: 'monospace' }}
                >
                  テーブル: kazikastudio.{table.name}
                </Typography>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="medium"
                  variant="contained"
                  fullWidth
                  onClick={() => router.push(`/master/${table.name}`)}
                  sx={{
                    backgroundColor: table.color,
                    '&:hover': {
                      backgroundColor: table.color,
                      filter: 'brightness(0.9)',
                    },
                  }}
                >
                  管理画面を開く
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
