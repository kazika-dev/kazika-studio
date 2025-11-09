'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import { TimelineBoard, Board, ZoomLevel, ZOOM_LEVELS } from './boardTypes';
import TimelineControls from './TimelineControls';
import TimelineRuler from './TimelineRuler';
import BoardTimelineTrack from './BoardTimelineTrack';
import BoardPreviewPanel from './BoardPreviewPanel';
import BoardDetailsPanel from './BoardDetailsPanel';

interface BoardTimelineContainerProps {
  studioId: number;
  boards: Board[];
  onBoardsChange?: (boards: TimelineBoard[]) => void;
}

export default function BoardTimelineContainer({
  studioId,
  boards: initialBoards,
  onBoardsChange,
}: BoardTimelineContainerProps) {
  // タイムライン状態
  const [boards, setBoards] = useState<TimelineBoard[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(60);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const animationFrameRef = useRef<number>();
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // BoardsをTimelineBoardsに変換
  useEffect(() => {
    if (initialBoards.length === 0) {
      setBoards([]);
      return;
    }

    // 既存のタイムライン情報とマージ
    const convertedBoards: TimelineBoard[] = initialBoards.map((board, index) => {
      const existingTimeline = boards.find((b) => b.id === board.id);

      // 開始時間を計算（前のボードの終了時間）
      let startTime = 0;
      if (index > 0) {
        const prevBoard = initialBoards[index - 1];
        const prevTimelineBoard = boards.find((b) => b.id === prevBoard.id);
        if (prevTimelineBoard) {
          startTime = Number(prevTimelineBoard.timeline_start) + Number(prevTimelineBoard.timeline_duration);
        } else {
          startTime = index * 5; // デフォルト5秒間隔
        }
      }

      return {
        ...board,
        timeline_start: Number(existingTimeline?.timeline_start ?? startTime),
        timeline_duration: Number(existingTimeline?.timeline_duration ?? (board.duration_seconds || 5)),
        transition_to_next: existingTimeline?.transition_to_next,
        effects: existingTimeline?.effects,
        workflow_steps: existingTimeline?.workflow_steps,
      };
    });

    setBoards(convertedBoards);

    // 総時間を計算
    const maxEndTime = convertedBoards.reduce((max, board) => {
      const endTime = board.timeline_start + board.timeline_duration;
      return Math.max(max, endTime);
    }, 60);
    setTotalDuration(Math.max(60, maxEndTime + 10));
  }, [initialBoards]);

  // WorkflowStepsを読み込む
  useEffect(() => {
    const loadWorkflowSteps = async () => {
      const boardsWithSteps = await Promise.all(
        boards.map(async (board) => {
          if (board.workflow_steps) return board;

          try {
            const response = await fetch(`/api/studios/boards/${board.id}/steps`);
            const data = await response.json();

            if (data.success) {
              return { ...board, workflow_steps: data.steps };
            }
          } catch (error) {
            console.error(`Failed to load steps for board ${board.id}:`, error);
          }

          return board;
        })
      );

      setBoards(boardsWithSteps);
    };

    if (boards.length > 0 && !boards[0].workflow_steps) {
      loadWorkflowSteps();
    }
  }, [boards.map((b) => b.id).join(',')]);

  // ボード変更を親に通知
  useEffect(() => {
    if (onBoardsChange && boards.length > 0) {
      onBoardsChange(boards);
    }
  }, [boards, onBoardsChange]);

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
      const timelineWidth = timelineScrollRef.current.clientWidth;
      const optimalZoom = Math.floor(timelineWidth / totalDuration);
      const closestZoom = ZOOM_LEVELS.reduce((prev, curr) =>
        Math.abs(curr - optimalZoom) < Math.abs(prev - optimalZoom) ? curr : prev
      ) as ZoomLevel;
      setZoomLevel(closestZoom);
    }
  };

  // ボード移動
  const handleBoardMove = (boardId: number, newStart: number) => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id === boardId ? { ...board, timeline_start: newStart } : board
      )
    );
  };

  // ボードリサイズ
  const handleBoardResize = (boardId: number, newDuration: number) => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id === boardId
          ? {
              ...board,
              timeline_duration: newDuration,
              duration_seconds: newDuration,
            }
          : board
      )
    );

    // データベースも更新
    fetch(`/api/studios/boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: newDuration }),
    }).catch((error) => console.error('Failed to update board duration:', error));
  };

  // ボード更新
  const handleBoardUpdate = (boardId: number, updates: Partial<TimelineBoard>) => {
    setBoards((prev) =>
      prev.map((board) => (board.id === boardId ? { ...board, ...updates } : board))
    );

    // 特定のフィールドをデータベースに保存
    const dbUpdates: any = {};
    if (updates.timeline_duration !== undefined) {
      dbUpdates.duration_seconds = updates.timeline_duration;
    }

    if (Object.keys(dbUpdates).length > 0) {
      fetch(`/api/studios/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUpdates),
      }).catch((error) => console.error('Failed to update board:', error));
    }
  };

  const selectedBoard =
    selectedBoardId ? boards.find((b) => b.id === selectedBoardId) ?? null : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#1e1e1e' }}>
      {/* プレビューパネル */}
      <BoardPreviewPanel
        boards={boards}
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
        gridSnapEnabled={snapEnabled}
        onGridSnapToggle={() => setSnapEnabled(!snapEnabled)}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={setPlaybackSpeed}
        onZoomToFit={handleZoomToFit}
      />

      {/* タイムライン本体 */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* メインタイムラインエリア */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* ルーラー */}
          <Box ref={timelineScrollRef} sx={{ overflow: 'auto' }}>
            <TimelineRuler
              totalDuration={totalDuration}
              zoomLevel={zoomLevel}
              currentTime={currentTime}
              onSeek={setCurrentTime}
            />

            {/* トラック */}
            <BoardTimelineTrack
              boards={boards}
              zoomLevel={zoomLevel}
              totalDuration={totalDuration}
              selectedBoardId={selectedBoardId}
              snapEnabled={snapEnabled}
              onBoardSelect={setSelectedBoardId}
              onBoardMove={handleBoardMove}
              onBoardResize={handleBoardResize}
            />
          </Box>
        </Box>

        {/* ボード詳細パネル */}
        <BoardDetailsPanel
          board={selectedBoard}
          onClose={() => setSelectedBoardId(null)}
          onUpdate={handleBoardUpdate}
        />
      </Box>
    </Box>
  );
}
