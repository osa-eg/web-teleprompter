export type RecordingPreference = 'auto' | 'mp4' | 'webm';

export interface RecordingFormat {
  mimeType: string;
  extension: 'mp4' | 'webm';
}

const MP4: RecordingFormat[] = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1,mp4a', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
];

const WEBM: RecordingFormat[] = [
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
];

/**
 * The first recording format the browser supports, in order of preference: MP4 (H.264/AAC) plays
 * everywhere, WebM (VP9, then VP8, with Opus) is the fallback. Safari records MP4, Firefox WebM,
 * Chromium both (H.264 only where the platform has an encoder).
 */
export function pickRecordingFormat(
  isTypeSupported: (mimeType: string) => boolean,
  preference: RecordingPreference = 'auto',
): RecordingFormat | null {
  const order = preference === 'webm' ? [...WEBM, ...MP4] : [...MP4, ...WEBM];
  return order.find((format) => isTypeSupported(format.mimeType)) ?? null;
}

/** WebM files from MediaRecorder carry no duration, so players cannot seek them until it is added. */
export function needsDurationFix(mimeType: string): boolean {
  return mimeType.startsWith('video/webm') || mimeType.startsWith('audio/webm');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `teleprompter-20260929-1742.mp4` (local time). */
export function recordingFileName(date: Date, extension: string): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `teleprompter-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.${extension}`;
}

/** Recordings longer than this get a one-time warning (they are kept in memory until saved). */
export const LONG_RECORDING_MS = 20 * 60 * 1000;
