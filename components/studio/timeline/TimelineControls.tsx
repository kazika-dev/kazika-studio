'use client';

import {
  Box,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import { ZOOM_LEVELS, ZoomLevel } from './types';

interface TimelineControlsProps {
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  gridSnapEnabled: boolean;
  onGridSnapToggle: () => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  onZoomToFit: () => void;
}

export default function TimelineControls({
  zoomLevel,
  onZoomChange,
  gridSnapEnabled,
  onGridSnapToggle,
  playbackSpeed,
  onPlaybackSpeedChange,
  onZoomToFit,
}: TimelineControlsProps) {
  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1,
        bgcolor: '#2d2d2d',
        borderBottom: '1px solid #424242',
      }}
    >
      {/* ズームコントロール */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="ズームアウト">
          <span>
            <IconButton
              size="small"
              onClick={handleZoomOut}
              disabled={zoomLevel === ZOOM_LEVELS[0]}
              sx={{ color: '#e0e0e0' }}
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Typography variant="caption" sx={{ color: '#9e9e9e', minWidth: 50, textAlign: 'center' }}>
          {zoomLevel}px/s
        </Typography>

        <Tooltip title="ズームイン">
          <span>
            <IconButton
              size="small"
              onClick={handleZoomIn}
              disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              sx={{ color: '#e0e0e0' }}
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="全体を表示">
          <IconButton size="small" onClick={onZoomToFit} sx={{ color: '#e0e0e0' }}>
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* グリッドスナップ */}
      <Tooltip title={gridSnapEnabled ? 'グリッドスナップ: ON' : 'グリッドスナップ: OFF'}>
        <ToggleButton
          value="snap"
          selected={gridSnapEnabled}
          onChange={onGridSnapToggle}
          size="small"
          sx={{
            color: gridSnapEnabled ? '#4caf50' : '#9e9e9e',
            borderColor: gridSnapEnabled ? '#4caf50' : '#424242',
            '&.Mui-selected': {
              bgcolor: 'rgba(76, 175, 80, 0.1)',
              color: '#4caf50',
              '&:hover': {
                bgcolor: 'rgba(76, 175, 80, 0.2)',
              },
            },
          }}
        >
          {gridSnapEnabled ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
        </ToggleButton>
      </Tooltip>

      {/* 再生速度 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
          再生速度:
        </Typography>
        <Select
          value={playbackSpeed}
          onChange={(e) => onPlaybackSpeedChange(Number(e.target.value))}
          size="small"
          sx={{
            color: '#e0e0e0',
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: '#424242',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#666',
            },
            '.MuiSvgIcon-root': {
              color: '#9e9e9e',
            },
          }}
        >
          <MenuItem value={0.25}>0.25x</MenuItem>
          <MenuItem value={0.5}>0.5x</MenuItem>
          <MenuItem value={1}>1x</MenuItem>
          <MenuItem value={2}>2x</MenuItem>
        </Select>
      </Box>
    </Box>
  );
}
