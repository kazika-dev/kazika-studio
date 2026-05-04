'use client';

import { useParams } from 'next/navigation';
import { Alert, Container } from '@mui/material';
import MobileSceneTimelineEditor from '@/components/scene-timeline/MobileSceneTimelineEditor';

export default function SceneTimelinePage() {
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const sceneId = idParam ? parseInt(idParam, 10) : NaN;

  if (isNaN(sceneId)) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="error">無効なシーンIDです</Alert>
      </Container>
    );
  }

  return <MobileSceneTimelineEditor sceneId={sceneId} />;
}
