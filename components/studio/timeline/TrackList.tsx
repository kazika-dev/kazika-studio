'use client';

import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import LayersIcon from '@mui/icons-material/Layers';
import { Track, TRACK_HEIGHTS } from './types';

interface TrackListProps {
  tracks: Track[];
  onTrackUpdate: (trackId: string, updates: Partial<Track>) => void;
}

export default function TrackList({ tracks, onTrackUpdate }: TrackListProps) {
  const getTrackIcon = (type: Track['type']) => {
    switch (type) {
      case 'video':
        return <VideoLibraryIcon fontSize="small" />;
      case 'audio':
        return <AudiotrackIcon fontSize="small" />;
      case 'image':
        return <ImageIcon fontSize="small" />;
      case 'text':
        return <TextFieldsIcon fontSize="small" />;
      case 'overlay':
        return <LayersIcon fontSize="small" />;
    }
  };

  return (
    <Box
      sx={{
        width: 200,
        bgcolor: '#2d2d2d',
        borderRight: '1px solid #424242',
        overflow: 'auto',
      }}
    >
      {tracks.map((track) => (
        <Box
          key={track.id}
          sx={{
            height: TRACK_HEIGHTS[track.type],
            borderBottom: '1px solid #424242',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: 2,
            py: 1,
            bgcolor: track.locked ? '#1a1a1a' : 'transparent',
          }}
        >
          {/* トラック名 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            {getTrackIcon(track.type)}
            <Typography
              variant="caption"
              sx={{
                color: '#e0e0e0',
                fontWeight: 600,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {track.name}
            </Typography>
          </Box>

          {/* コントロールボタン */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* ミュート */}
            {(track.type === 'video' || track.type === 'audio') && (
              <Tooltip title={track.muted ? 'ミュート解除' : 'ミュート'}>
                <IconButton
                  size="small"
                  onClick={() => onTrackUpdate(track.id, { muted: !track.muted })}
                  sx={{
                    color: track.muted ? '#f57c00' : '#9e9e9e',
                    '&:hover': { color: '#f57c00' },
                  }}
                >
                  {track.muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}

            {/* ロック */}
            <Tooltip title={track.locked ? 'ロック解除' : 'ロック'}>
              <IconButton
                size="small"
                onClick={() => onTrackUpdate(track.id, { locked: !track.locked })}
                sx={{
                  color: track.locked ? '#f44336' : '#9e9e9e',
                  '&:hover': { color: '#f44336' },
                }}
              >
                {track.locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* 表示/非表示 */}
            <Tooltip title={track.visible ? '非表示' : '表示'}>
              <IconButton
                size="small"
                onClick={() => onTrackUpdate(track.id, { visible: !track.visible })}
                sx={{
                  color: track.visible ? '#4caf50' : '#9e9e9e',
                  '&:hover': { color: '#4caf50' },
                }}
              >
                {track.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
