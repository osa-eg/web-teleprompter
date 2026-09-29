import { useEffect, useRef } from 'react';
import type { Command } from '@/core/commands/types';

/** Ten seconds of 8 kHz silence (browsers only route media keys to pages that play audio). */
function silentWavUrl(): string {
  const samples = 8000 * 10;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128); // 8-bit silence
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const ACTIONS: [MediaSessionAction, Command][] = [
  ['play', { type: 'play' }],
  ['pause', { type: 'pause' }],
  ['stop', { type: 'pause' }],
  ['nexttrack', { type: 'jumpBlock', delta: 1 }],
  ['previoustrack', { type: 'jumpBlock', delta: -1 }],
  ['seekforward', { type: 'nudgeWpm', steps: 1 }],
  ['seekbackward', { type: 'nudgeWpm', steps: -1 }],
];

/**
 * "Media keys" mode: play/pause and next/previous from Bluetooth rings, headsets and keyboard
 * media keys control the prompter — also while another window has the focus — through the Media
 * Session API. A silent audio loop (started by the first click or key press) keeps this page the
 * active media session.
 */
export function useMediaKeys(
  enabled: boolean,
  title: string,
  playing: boolean,
  onCommand: (c: Command) => void,
) {
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  });

  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return;
    const url = silentWavUrl();
    const audio = new Audio(url);
    audio.loop = true;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      audio.play().catch(() => {
        started = false;
      });
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    for (const [action, command] of ACTIONS) {
      try {
        navigator.mediaSession.setActionHandler(action, () => onCommandRef.current(command));
      } catch {
        // Action not supported by this browser.
      }
    }
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      for (const [action] of ACTIONS) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
      audio.pause();
      audio.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    if ('MediaMetadata' in window) {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Web Teleprompter' });
    }
  }, [enabled, playing, title]);
}
