export interface Board {
  id: number;
  studio_id: number;
  sequence_order: number;
  title: string;
  description: string;
  workflow_id: number | null;
  audio_output_id: number | null;
  image_output_id: number | null;
  video_output_id: number | null;
  custom_audio_url: string | null;
  custom_image_url: string | null;
  custom_video_url: string | null;
  prompt_text: string;
  duration_seconds: number | null;
  status: 'draft' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: number;
  board_id: number;
  workflow_id: number;
  workflow_name?: string;
  workflow_description?: string;
  step_order: number;
  input_config: any;
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

export interface TimelineBoard extends Board {
  timeline_start: number;
  timeline_duration: number;
  transition_to_next?: {
    type: 'fade' | 'slide' | 'wipe' | 'dissolve' | 'none';
    duration: number;
  };
  effects?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    filter?: 'grayscale' | 'sepia' | 'blur' | 'none';
  };
  workflow_steps?: WorkflowStep[];
  thumbnail_url?: string;
}

export interface BoardTimelineState {
  boards: TimelineBoard[];
  currentTime: number;
  totalDuration: number;
  zoomLevel: number;
  isPlaying: boolean;
  selectedBoardId: number | null;
  snapEnabled: boolean;
  playbackSpeed: number;
}

export const ZOOM_LEVELS = [10, 20, 40, 60, 80, 100, 150, 200] as const;
export type ZoomLevel = typeof ZOOM_LEVELS[number];

export const BOARD_STATUS_COLORS = {
  draft: '#757575',
  processing: '#2196f3',
  completed: '#4caf50',
  error: '#f44336',
} as const;
