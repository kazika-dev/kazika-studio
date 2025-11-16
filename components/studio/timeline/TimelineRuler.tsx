'use client';

import { Box, Typography } from '@mui/material';
import { useMemo } from 'react';

interface TimelineRulerProps {
  totalDuration: number;
  zoomLevel: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function TimelineRuler({
  totalDuration,
  zoomLevel,
  currentTime,
  onSeek,
}: TimelineRulerProps) {
  // ズームレベルに応じた目盛り間隔を決定
  const tickInterval = useMemo(() => {
    if (zoomLevel >= 100) return 1; // 1秒刻み
    if (zoomLevel >= 40) return 5; // 5秒刻み
    return 10; // 10秒刻み
  }, [zoomLevel]);

  // 目盛りの配列を生成
  const ticks = useMemo(() => {
    const result: number[] = [];
    for (let t = 0; t <= totalDuration; t += tickInterval) {
      result.push(t);
    }
    // 最後の時間が総時間と異なる場合は追加
    if (result[result.length - 1] !== totalDuration) {
      result.push(totalDuration);
    }
    return result;
  }, [totalDuration, tickInterval]);

  // 時間を表示形式に変換（MM:SS）
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ルーラークリック時の処理
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = x / zoomLevel;
    onSeek(Math.max(0, Math.min(time, totalDuration)));
  };

  const totalWidth = totalDuration * zoomLevel;

  return (
    <Box
      sx={{
        position: 'relative',
        height: 40,
        bgcolor: '#2d2d2d',
        borderBottom: '1px solid #424242',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onClick={handleClick}
    >
      {/* 目盛り */}
      <Box sx={{ position: 'relative', height: '100%', width: totalWidth }}>
        {ticks.map((tick) => {
          const x = tick * zoomLevel;
          return (
            <Box
              key={tick}
              sx={{
                position: 'absolute',
                left: x,
                top: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              {/* 目盛り線 */}
              <Box
                sx={{
                  width: 1,
                  height: 12,
                  bgcolor: '#666',
                }}
              />
              {/* 時間表示 */}
              <Typography
                variant="caption"
                sx={{
                  color: '#9e9e9e',
                  fontSize: '0.7rem',
                  ml: 0.5,
                  mt: 0.5,
                }}
              >
                {formatTime(tick)}
              </Typography>
            </Box>
          );
        })}

        {/* 再生ヘッド */}
        <Box
          sx={{
            position: 'absolute',
            left: currentTime * zoomLevel,
            top: 0,
            width: 2,
            height: '100%',
            bgcolor: '#ff0000',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* 再生ヘッドのハンドル */}
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              left: -6,
              width: 14,
              height: 14,
              bgcolor: '#ff0000',
              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
