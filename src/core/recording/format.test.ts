import { describe, expect, it } from 'vitest';
import { needsDurationFix, pickRecordingFormat, recordingFileName } from './format';

const safari = (type: string) => type === 'video/mp4' || type.startsWith('video/mp4;codecs=avc1');
const firefox = (type: string) => type.startsWith('video/webm') && !type.includes('vp9');
const chromium = (type: string) => type.startsWith('video/webm');
const chrome = (type: string) => type.startsWith('video/webm') || type.startsWith('video/mp4');

describe('recording format', () => {
  it('prefers MP4 where it can be recorded', () => {
    expect(pickRecordingFormat(safari)?.extension).toBe('mp4');
    expect(pickRecordingFormat(chrome)?.mimeType).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
  });

  it('falls back to WebM, VP9 first', () => {
    expect(pickRecordingFormat(chromium)?.mimeType).toBe('video/webm;codecs=vp9,opus');
    expect(pickRecordingFormat(firefox)?.mimeType).toBe('video/webm;codecs=vp8,opus');
  });

  it('follows a WebM preference and handles no support at all', () => {
    expect(pickRecordingFormat(chrome, 'webm')?.extension).toBe('webm');
    expect(pickRecordingFormat(safari, 'webm')?.extension).toBe('mp4');
    expect(pickRecordingFormat(() => false)).toBeNull();
  });

  it('fixes the duration of WebM only', () => {
    expect(needsDurationFix('video/webm;codecs=vp9,opus')).toBe(true);
    expect(needsDurationFix('video/mp4')).toBe(false);
  });

  it('names files by date and time', () => {
    expect(recordingFileName(new Date(2026, 8, 29, 7, 5), 'mp4')).toBe('teleprompter-20260929-0705.mp4');
  });
});
