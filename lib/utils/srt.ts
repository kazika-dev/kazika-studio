/**
 * SRT (SubRip Subtitle) file generation utilities
 */

import type { ConversationMessageWithCharacter } from '@/types/conversation';

/**
 * Format milliseconds to SRT timestamp format (HH:MM:SS,mmm)
 * @param ms - milliseconds
 * @returns formatted timestamp string
 */
export function formatSrtTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Remove emotion tags from message text (e.g., [friendly] Hello -> Hello)
 * @param text - message text with possible emotion tag
 * @returns cleaned text without emotion tag prefix
 */
export function removeEmotionTag(text: string): string {
  // Remove [tag] prefix if present
  return text.replace(/^\[[^\]]+\]\s*/, '');
}

export interface SrtOptions {
  /**
   * Whether to include speaker names in the subtitle
   * @default true
   */
  includeSpeakerName?: boolean;

  /**
   * Default duration in milliseconds when audio_duration_seconds is not available
   * @default 3000
   */
  defaultDurationMs?: number;

  /**
   * Gap between subtitles in milliseconds
   * @default 0 (no gap to match audio file duration)
   */
  gapMs?: number;
}

/**
 * Generate SRT content from conversation messages
 * @param messages - array of conversation messages
 * @param options - SRT generation options
 * @returns SRT file content as string
 */
export function generateSrt(
  messages: ConversationMessageWithCharacter[],
  options: SrtOptions = {}
): string {
  const {
    includeSpeakerName = false,
    defaultDurationMs = 3000,
    gapMs = 0,  // No gap by default to match audio file duration
  } = options;

  // Sort messages by sequence_order
  const sortedMessages = [...messages].sort(
    (a, b) => a.sequence_order - b.sequence_order
  );

  const lines: string[] = [];
  let currentTimeMs = 0;

  sortedMessages.forEach((message, index) => {
    const subtitleNumber = index + 1;

    // Calculate start time
    // If timestamp_ms is available, use it; otherwise, use cumulative time
    const startTimeMs = message.timestamp_ms ?? currentTimeMs;

    // Calculate duration
    const durationMs = message.audio_duration_seconds
      ? message.audio_duration_seconds * 1000
      : defaultDurationMs;

    // Calculate end time
    const endTimeMs = startTimeMs + durationMs;

    // Format timestamps
    const startTimestamp = formatSrtTimestamp(startTimeMs);
    const endTimestamp = formatSrtTimestamp(endTimeMs);

    // Format subtitle text
    const cleanText = removeEmotionTag(message.message_text);
    const speakerName = message.character?.name || message.speaker_name;
    const subtitleText = includeSpeakerName && speakerName
      ? `${speakerName}: ${cleanText}`
      : cleanText;

    // Add subtitle entry
    lines.push(subtitleNumber.toString());
    lines.push(`${startTimestamp} --> ${endTimestamp}`);
    lines.push(subtitleText);
    lines.push(''); // Empty line between entries

    // Update current time for next subtitle
    currentTimeMs = endTimeMs + gapMs;
  });

  return lines.join('\n');
}

/**
 * Download SRT content as a file
 * @param content - SRT file content
 * @param filename - filename without extension
 */
export function downloadSrt(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
