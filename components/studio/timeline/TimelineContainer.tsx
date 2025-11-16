'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Paper } from '@mui/material';
import { TimelineStep, Track, ZOOM_LEVELS, ZoomLevel, WorkflowStep } from './types';
import TimelineControls from './TimelineControls';
import TimelineRuler from './TimelineRuler';
import TrackList from './TrackList';
import TimelineTrack from './TimelineTrack';
import PreviewPanel from './PreviewPanel';
import StepDetailsPanel from './StepDetailsPanel';

interface TimelineContainerProps {
  boardId: number;
  workflowSteps: WorkflowStep[];
  onStepsChange?: (steps: TimelineStep[]) => void;
}

export default function TimelineContainer({
  boardId,
  workflowSteps,
  onStepsChange,
}: TimelineContainerProps) {
  // タイムライン状態
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'video-1', type: 'video', name: 'Video Track 1', height: 120, muted: false, solo: false, locked: false, visible: true },
    { id: 'video-2', type: 'overlay', name: 'Overlay Track', height: 100, muted: false, solo: false, locked: false, visible: true },
    { id: 'audio-1', type: 'audio', name: 'Audio Track 1', height: 60, muted: false, solo: false, locked: false, visible: true },
    { id: 'image-1', type: 'image', name: 'Image Track', height: 80, muted: false, solo: false, locked: false, visible: true },
    { id: 'text-1', type: 'text', name: 'Text Track', height: 80, muted: false, solo: false, locked: false, visible: true },
  ]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(60);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [gridSnapInterval] = useState(1); // 1秒
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const animationFrameRef = useRef<number | undefined>(undefined);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // WorkflowStepsをTimelineStepsに変換
  useEffect(() => {
    if (workflowSteps.length === 0) {
      setSteps([]);
      return;
    }

    // 既存のタイムラインステップとマージ
    const convertedSteps: TimelineStep[] = workflowSteps.map((ws, index) => {
      // 既存のタイムライン情報を検索
      const existingTimelineStep = steps.find(s => s.id === ws.id);

      // トラックタイプを推測
      let trackType: TimelineStep['timeline_track'] = 'video';
      if (ws.output_data?.audioData) {
        trackType = 'audio';
      } else if (ws.output_data?.imageData || ws.output_data?.imageUrl) {
        trackType = 'image';
      } else if (ws.output_data?.response && !ws.output_data?.imageUrl && !ws.output_data?.videoUrl) {
        trackType = 'text';
      } else if (ws.output_data?.videoUrl) {
        trackType = 'video';
      }

      return {
        ...ws,
        timeline_track: existingTimelineStep?.timeline_track ?? trackType,
        timeline_start: existingTimelineStep?.timeline_start ?? index * 5, // 5秒間隔でデフォルト配置
        timeline_duration: existingTimelineStep?.timeline_duration ?? (ws.output_data?.duration || 5),
        timeline_layer: existingTimelineStep?.timeline_layer ?? 0,
        transition_in: existingTimelineStep?.transition_in,
        transition_out: existingTimelineStep?.transition_out,
        effects: existingTimelineStep?.effects,
      };
    });

    setSteps(convertedSteps);

    // 総時間を計算
    const maxEndTime = convertedSteps.reduce((max, step) => {
      const endTime = step.timeline_start + step.timeline_duration;
      return Math.max(max, endTime);
    }, 60);
    setTotalDuration(Math.max(60, maxEndTime + 10)); // 最低60秒、最後のステップの後に10秒余裕を持たせる
  }, [workflowSteps]);

  // ステップ変更を親に通知
  useEffect(() => {
    if (onStepsChange && steps.length > 0) {
      onStepsChange(steps);
    }
  }, [steps, onStepsChange]);

  // 再生機能
  const play = useCallback(() => {
    setIsPlaying(true);
    const startTime = Date.now();
    const initialPosition = currentTime;

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newPosition = initialPosition + elapsed * playbackSpeed;

      if (newPosition >= totalDuration) {
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        return;
      }

      setCurrentTime(newPosition);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [currentTime, playbackSpeed, totalDuration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ズーム調整
  const handleZoomToFit = () => {
    if (timelineScrollRef.current) {
      const timelineWidth = timelineScrollRef.current.clientWidth - 200; // TrackListの幅を引く
      const optimalZoom = Math.floor(timelineWidth / totalDuration);
      const closestZoom = ZOOM_LEVELS.reduce((prev, curr) =>
        Math.abs(curr - optimalZoom) < Math.abs(prev - optimalZoom) ? curr : prev
      ) as ZoomLevel;
      setZoomLevel(closestZoom);
    }
  };

  // ステップ移動
  const handleStepMove = (stepId: number, newStart: number, newTrack: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? { ...step, timeline_start: newStart }
          : step
      )
    );
  };

  // ステップリサイズ
  const handleStepResize = (stepId: number, newDuration: number, newStart?: number) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              timeline_duration: newDuration,
              ...(newStart !== undefined ? { timeline_start: newStart } : {}),
            }
          : step
      )
    );
  };

  // ステップ更新
  const handleStepUpdate = (stepId: number, updates: Partial<TimelineStep>) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, ...updates } : step))
    );
  };

  // トラック更新
  const handleTrackUpdate = (trackId: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, ...updates } : track))
    );
  };

  const selectedStep = selectedStepId ? steps.find((s) => s.id === selectedStepId) ?? null : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#1e1e1e' }}>
      {/* プレビューパネル */}
      <PreviewPanel
        steps={steps}
        currentTime={currentTime}
        totalDuration={totalDuration}
        isPlaying={isPlaying}
        onPlay={play}
        onPause={pause}
        onSeek={setCurrentTime}
      />

      {/* タイムラインコントロール */}
      <TimelineControls
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        gridSnapEnabled={gridSnapEnabled}
        onGridSnapToggle={() => setGridSnapEnabled(!gridSnapEnabled)}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={setPlaybackSpeed}
        onZoomToFit={handleZoomToFit}
      />

      {/* タイムライン本体 */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* メインタイムラインエリア */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* ルーラー */}
          <Box sx={{ display: 'flex' }}>
            <Box sx={{ width: 200, flexShrink: 0, bgcolor: '#2d2d2d', borderBottom: '1px solid #424242' }} />
            <Box ref={timelineScrollRef} sx={{ flex: 1, overflow: 'auto' }}>
              <TimelineRuler
                totalDuration={totalDuration}
                zoomLevel={zoomLevel}
                currentTime={currentTime}
                onSeek={setCurrentTime}
              />
            </Box>
          </Box>

          {/* トラックエリア */}
          <Box sx={{ display: 'flex', flex: 1, overflow: 'auto' }}>
            {/* トラックリスト */}
            <TrackList tracks={tracks} onTrackUpdate={handleTrackUpdate} />

            {/* トラック */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {tracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  steps={steps}
                  zoomLevel={zoomLevel}
                  totalDuration={totalDuration}
                  selectedStepId={selectedStepId}
                  gridSnapEnabled={gridSnapEnabled}
                  gridSnapInterval={gridSnapInterval}
                  onStepSelect={setSelectedStepId}
                  onStepMove={handleStepMove}
                  onStepResize={handleStepResize}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* ステップ詳細パネル */}
        <StepDetailsPanel
          step={selectedStep}
          onClose={() => setSelectedStepId(null)}
          onUpdate={handleStepUpdate}
        />
      </Box>
    </Box>
  );
}
