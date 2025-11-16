export interface WorkflowStep {
  id: number;
  board_id: number;
  workflow_id: number;
  workflow_name?: string;
  workflow_description?: string;
  step_order: number;
  input_config: {
    usePrompt?: boolean;
    prompt?: string;
    usePreviousImage?: boolean;
    usePreviousVideo?: boolean;
    usePreviousAudio?: boolean;
    usePreviousText?: boolean;
    workflowInputs?: Record<string, any>;
  };
  execution_status: 'pending' | 'running' | 'completed' | 'failed';
  output_data: {
    imageData?: { data: string; mimeType: string };
    imageUrl?: string;
    videoUrl?: string;
    audioData?: { data: string; mimeType: string };
    response?: string;
    duration?: number;
    storagePath?: string;
    jobId?: string;
  };
  error_message: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export type TrackType = 'video' | 'audio' | 'image' | 'text' | 'overlay';

export interface TimelineStep extends WorkflowStep {
  timeline_track: TrackType;
  timeline_start: number;
  timeline_duration: number;
  timeline_layer: number;
  transition_in?: {
    type: 'fade' | 'slide' | 'zoom' | 'none';
    duration: number;
  };
  transition_out?: {
    type: 'fade' | 'slide' | 'zoom' | 'none';
    duration: number;
  };
  effects?: {
    opacity?: number;
    position?: { x: number; y: number };
    scale?: number;
    rotation?: number;
  };
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  height: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  visible: boolean;
}

export interface TimelineState {
  steps: TimelineStep[];
  tracks: Track[];
  currentTime: number;
  totalDuration: number;
  zoomLevel: number;
  isPlaying: boolean;
  selectedStepId: number | null;
  gridSnapEnabled: boolean;
  gridSnapInterval: number;
  playbackSpeed: number;
}

export const ZOOM_LEVELS = [10, 20, 40, 60, 80, 100, 150, 200] as const;
export type ZoomLevel = typeof ZOOM_LEVELS[number];

export const TRACK_HEIGHTS: Record<TrackType, number> = {
  video: 120,
  audio: 60,
  image: 80,
  text: 80,
  overlay: 100,
};

export const TRACK_COLORS: Record<TrackType, string> = {
  video: '#1976d2',
  audio: '#388e3c',
  image: '#7b1fa2',
  text: '#f57c00',
  overlay: '#d32f2f',
};
