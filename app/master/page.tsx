'use client';

import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  PhotoCamera as PhotoCameraIcon,
  ZoomIn as ZoomInIcon,
  MusicNote as MusicNoteIcon,
} from '@mui/icons-material';

interface MasterTable {
  id: string;
  name: string;
  tableName: string;
  description: string;
  icon: React.ReactNode;
  count?: number;
}

const masterTables: MasterTable[] = [
  {
    id: 'm_camera_angles',
    name: 'カメラアングル',
    tableName: 'm_camera_angles',
    description: 'カメラの角度マスタ（High Angle, Low Angleなど）',
    icon: <PhotoCameraIcon fontSize="large" />,
  },
  {
    id: 'm_camera_movements',
    name: 'カメラムーブメント',
    tableName: 'm_camera_movements',
    description: 'カメラの動きマスタ（Pan, Tilt, Zoomなど）',
    icon: <VideocamIcon fontSize="large" />,
  },
  {
    id: 'm_shot_distances',
    name: 'ショット距離',
    tableName: 'm_shot_distances',
    description: '撮影距離マスタ（Close-up, Medium Shot, Long Shotなど）',
    icon: <ZoomInIcon fontSize="large" />,
  },
  {
    id: 'eleven_labs_tags',
    name: 'ElevenLabs タグ',
    tableName: 'eleven_labs_tags',
    description: 'ElevenLabsの音声タグマスタ',
    icon: <MusicNoteIcon fontSize="large" />,
  },
];

export default function MasterPage() {
  const router = useRouter();

  const handleCardClick = (tableName: string) => {
    router.push(`/master/${tableName}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          マスタ管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          各種マスタデータを管理します
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {masterTables.map((table) => (
          <Grid item xs={12} sm={6} md={6} key={table.id}>
            <Card>
              <CardActionArea onClick={() => handleCardClick(table.tableName)}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Box
                      sx={{
                        mr: 2,
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {table.icon}
                    </Box>
                    <Box flexGrow={1}>
                      <Typography variant="h6" component="h2">
                        {table.name}
                      </Typography>
                      {table.count !== undefined && (
                        <Chip
                          label={`${table.count}件`}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {table.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
