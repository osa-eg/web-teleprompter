import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PlayState } from '@/core/engine/types';
import { LONG_RECORDING_MS, pickRecordingFormat, recordingFileName } from '@/core/recording/format';
import { downloadBlob } from '@/lib/download';
import type { CameraSettings } from '@/stores/settingsSchema';
import { Recorder, type RecordingResult } from './Recorder';

/**
 * idle → waiting (for the camera) → recording → saving → idle, or idle → armed (until playback
 * starts, when recording with the script) → recording.
 */
export type RecordState = 'idle' | 'armed' | 'waiting' | 'recording' | 'saving';

interface Callbacks {
  onSaved: (fileName: string) => void;
  onProblem: (problem: 'unsupported' | 'failed' | 'long') => void;
}

interface Inputs {
  stream: MediaStream | null;
  play: PlayState;
  camera: CameraSettings;
}

interface Snapshot {
  state: RecordState;
  elapsedMs: number;
}

function save(result: RecordingResult | null): string | null {
  if (!result || result.blob.size === 0) return null;
  const name = recordingFileName(new Date(), result.format.extension);
  downloadBlob(name, result.blob);
  return name;
}

/** Drives the recorder from the camera stream, the play state and the record button. */
class RecordingController {
  private readonly recorder = new Recorder();
  private snapshot: Snapshot = { state: 'idle', elapsedMs: 0 };
  private readonly listeners = new Set<() => void>();
  private inputs: Inputs | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warned = false;
  private callbacks: Callbacks;

  constructor(callbacks: Callbacks) {
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: Callbacks): void {
    this.callbacks = callbacks;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  update(inputs: Inputs): void {
    this.inputs = inputs;
    const { stream, play, camera } = inputs;
    const { state } = this.snapshot;
    if (stream && (state === 'waiting' || (state === 'armed' && play === 'playing'))) this.begin(stream);
    else if (state === 'recording' && (!stream || (camera.recordWithPlay && play === 'ended'))) {
      void this.finish();
    }
  }

  toggle = (): void => {
    const { state } = this.snapshot;
    if (state === 'recording') return void this.finish();
    if (state === 'saving') return;
    if (state === 'armed' || state === 'waiting') return this.set({ state: 'idle' });
    const play = this.inputs?.play ?? 'idle';
    const playing = play === 'playing' || play === 'countdown';
    this.set({ state: this.inputs?.camera.recordWithPlay && !playing ? 'armed' : 'waiting' });
    if (this.inputs) this.update(this.inputs);
  };

  /** Leaving the prompter never loses a take. */
  dispose(): void {
    this.stopTimer();
    if (this.recorder.recording) void this.recorder.stop().then(save);
  }

  private begin(stream: MediaStream): void {
    const camera = this.inputs!.camera;
    const format =
      typeof MediaRecorder === 'undefined'
        ? null
        : pickRecordingFormat((type) => MediaRecorder.isTypeSupported(type), camera.format);
    if (!format) {
      this.set({ state: 'idle' });
      this.callbacks.onProblem('unsupported');
      return;
    }
    try {
      this.recorder.start(stream, format, camera.videoBitsPerSecond);
    } catch {
      this.set({ state: 'idle' });
      this.callbacks.onProblem('failed');
      return;
    }
    this.warned = false;
    this.set({ state: 'recording', elapsedMs: 0 });
    this.timer = setInterval(() => {
      const elapsedMs = this.recorder.elapsedMs;
      this.set({ elapsedMs });
      if (!this.warned && elapsedMs > LONG_RECORDING_MS) {
        this.warned = true;
        this.callbacks.onProblem('long');
      }
    }, 500);
  }

  private async finish(): Promise<void> {
    if (!this.recorder.recording) return;
    this.stopTimer();
    const stopped = this.recorder.stop();
    this.set({ state: 'saving' });
    const name = save(await stopped);
    this.set({ state: 'idle', elapsedMs: 0 });
    if (name) this.callbacks.onSaved(name);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private set(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}

export function useRecording({ stream, play, camera, onSaved, onProblem }: Inputs & Callbacks) {
  const [controller] = useState(() => new RecordingController({ onSaved, onProblem }));
  useEffect(() => {
    controller.setCallbacks({ onSaved, onProblem });
  });
  useEffect(() => {
    controller.update({ stream, play, camera });
  }, [controller, stream, play, camera]);
  useEffect(() => () => controller.dispose(), [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return { ...snapshot, toggle: controller.toggle };
}
