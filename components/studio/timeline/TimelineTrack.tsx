'use client';

import { Box } from '@mui/material';
import { Track, TimelineStep, TRACK_HEIGHTS } from './types';
import TimelineStepBlock from './TimelineStepBlock';
import { useState } from 'react';

interface TimelineTrackProps {
  track: Track;
  steps: TimelineStep[];
  zoomLevel: number;
  totalDuration: number;
  selectedStepId: number | null;
  gridSnapEnabled: boolean;
  gridSnapInterval: number;
  onStepSelect: (stepId: number) => void;
  onStepMove: (stepId: number, newStart: number, newTrack: string) => void;
  onStepResize: (stepId: number, newDuration: number, newStart?: number) => void;
}

export default function TimelineTrack({
  track,
  steps,
  zoomLevel,
  totalDuration,
  selectedStepId,
  gridSnapEnabled,
  gridSnapInterval,
  onStepSelect,
  onStepMove,
  onStepResize,
}: TimelineTrackProps) {
  const [resizingHandle, setResizingHandle] = useState<'left' | 'right' | null>(null);
  const [resizingStepId, setResizingStepId] = useState<number | null>(null);

  const trackHeight = TRACK_HEIGHTS[track.type];
  const trackSteps = steps.filter((s) => s.timeline_track === track.type);

  // グリッドスナップ
  const snapToGrid = (time: number): number => {
    if (!gridSnapEnabled) return time;
    return Math.round(time / gridSnapInterval) * gridSnapInterval;
  };

  // ステップ移動
  const handleStepMove = (stepId: number, deltaX: number, deltaY: number) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step || track.locked) return;

    const deltaTime = deltaX / zoomLevel;
    let newStart = step.timeline_start + deltaTime;
    newStart = Math.max(0, Math.min(newStart, totalDuration - step.timeline_duration));
    newStart = snapToGrid(newStart);

    onStepMove(stepId, newStart, track.id);
  };

  // リサイズ開始
  const handleResizeStart = (stepId: number, handle: 'left' | 'right') => {
    if (track.locked) return;
    setResizingHandle(handle);
    setResizingStepId(stepId);
  };

  // リサイズ移動
  const handleResizeMove = (stepId: number, deltaX: number) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step || track.locked) return;

    const deltaTime = deltaX / zoomLevel;

    if (resizingHandle === 'right') {
      // 右端: 長さを変更
      let newDuration = step.timeline_duration + deltaTime;
      newDuration = Math.max(0.1, Math.min(newDuration, totalDuration - step.timeline_start));
      newDuration = snapToGrid(newDuration);
      onStepResize(stepId, newDuration);
    } else if (resizingHandle === 'left') {
      // 左端: 開始位置と長さを両方変更
      let newStart = step.timeline_start + deltaTime;
      newStart = Math.max(0, newStart);
      newStart = snapToGrid(newStart);

      const newDuration = step.timeline_duration - (newStart - step.timeline_start);
      if (newDuration >= 0.1) {
        onStepResize(stepId, newDuration, newStart);
      }
    }
  };

  // リサイズ終了
  const handleResizeEnd = () => {
    setResizingHandle(null);
    setResizingStepId(null);
  };

  const totalWidth = totalDuration * zoomLevel;

  return (
    <Box
      sx={{
        position: 'relative',
        height: trackHeight,
        width: totalWidth,
        bgcolor: track.visible ? '#252525' : '#1a1a1a',
        borderBottom: '1px solid #424242',
        opacity: track.muted ? 0.5 : 1,
      }}
    >
      {/* グリッド線 */}
      {gridSnapEnabled && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {Array.from({ length: Math.ceil(totalDuration / gridSnapInterval) }).map((_, i) => {
            const x = i * gridSnapInterval * zoomLevel;
            return (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  width: 1,
                  height: '100%',
                  bgcolor: '#3a3a3a',
                  opacity: 0.3,
                }}
              />
            );
          })}
        </Box>
      )}

      {/* ステップブロック */}
      {trackSteps.map((step) => (
        <Box
          key={step.id}
          sx={{
            position: 'absolute',
            left: step.timeline_start * zoomLevel,
            top: 4,
            height: trackHeight - 8,
          }}
        >
          <TimelineStepBlock
            step={step}
            zoomLevel={zoomLevel}
            isSelected={selectedStepId === step.id}
            onSelect={() => onStepSelect(step.id)}
            onMove={(deltaX, deltaY) => handleStepMove(step.id, deltaX, deltaY)}
            onResizeStart={(handle) => handleResizeStart(step.id, handle)}
            onResizeMove={(deltaX) => handleResizeMove(step.id, deltaX)}
            onResizeEnd={handleResizeEnd}
          />
        </Box>
      ))}
    </Box>
  );
}
