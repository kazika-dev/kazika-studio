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

/**
 * Split text into chunks by Japanese phrase boundaries (文節)
 * @param text - text to split
 * @param maxChars - maximum characters per chunk
 * @returns array of text chunks
 */
export function splitByPhrase(text: string, maxChars: number = 11): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Find the best split point within maxChars
    let splitPoint = maxChars;

    // Look for phrase boundaries (助詞、句読点、接続詞の後など)
    // Priority: 句読点 > 助詞 > any character
    const searchRange = remaining.slice(0, maxChars);

    // 1. Look for punctuation (。、！？）」』)
    const punctuationMatch = searchRange.match(/.*[。、！？）」』\n]/);
    if (punctuationMatch) {
      splitPoint = punctuationMatch[0].length;
    } else {
      // 2. Look for phrase-ending particles (助詞: は、が、を、に、で、と、も、の、へ、や、か、ね、よ、な、さ)
      // Split AFTER the particle
      const particleMatch = searchRange.match(/.*[はがをにでともへやかねよなさ]/);
      if (particleMatch) {
        splitPoint = particleMatch[0].length;
      } else {
        // 3. If no good split point found, just split at maxChars
        splitPoint = maxChars;
      }
    }

    chunks.push(remaining.slice(0, splitPoint));
    remaining = remaining.slice(splitPoint);
  }

  return chunks;
}

export interface SrtOptions {
  /**
   * Whether to include speaker names in the subtitle
   * @default false
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

  /**
   * Maximum characters per subtitle chunk (for splitting long messages)
   * Set to 0 or undefined to disable splitting
   * @default undefined (no splitting)
   */
  maxCharsPerChunk?: number;
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
    maxCharsPerChunk,
  } = options;

  // Sort messages by sequence_order
  const sortedMessages = [...messages].sort(
    (a, b) => a.sequence_order - b.sequence_order
  );

  const lines: string[] = [];
  let currentTimeMs = 0;
  let subtitleNumber = 0;

  sortedMessages.forEach((message) => {
    // Calculate start time for this message
    const messageStartTimeMs = message.timestamp_ms ?? currentTimeMs;

    // Calculate total duration for this message
    const messageDurationMs = message.audio_duration_seconds
      ? message.audio_duration_seconds * 1000
      : defaultDurationMs;

    // Format subtitle text
    const cleanText = removeEmotionTag(message.message_text);
    const speakerName = message.character?.name || message.speaker_name;
    const baseText = includeSpeakerName && speakerName
      ? `${speakerName}: ${cleanText}`
      : cleanText;

    // Split text into chunks if maxCharsPerChunk is set
    const chunks = maxCharsPerChunk && maxCharsPerChunk > 0
      ? splitByPhrase(baseText, maxCharsPerChunk)
      : [baseText];

    // Calculate duration per chunk (proportional to character count)
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    let chunkStartTimeMs = messageStartTimeMs;

    chunks.forEach((chunk) => {
      subtitleNumber++;

      // Calculate chunk duration proportionally
      const chunkDurationMs = totalChars > 0
        ? (chunk.length / totalChars) * messageDurationMs
        : messageDurationMs / chunks.length;

      const chunkEndTimeMs = chunkStartTimeMs + chunkDurationMs;

      // Format timestamps
      const startTimestamp = formatSrtTimestamp(chunkStartTimeMs);
      const endTimestamp = formatSrtTimestamp(chunkEndTimeMs);

      // Remove punctuation (。、) from chunk text
      const cleanedChunk = chunk.replace(/[。、]/g, '');

      // Add subtitle entry
      lines.push(subtitleNumber.toString());
      lines.push(`${startTimestamp} --> ${endTimestamp}`);
      lines.push(cleanedChunk);
      lines.push(''); // Empty line between entries

      // Update start time for next chunk
      chunkStartTimeMs = chunkEndTimeMs;
    });

    // Update current time for next message
    currentTimeMs = messageStartTimeMs + messageDurationMs + gapMs;
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
