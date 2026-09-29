import { needsDurationFix, type RecordingFormat } from '@/core/recording/format';

export interface RecordingResult {
  blob: Blob;
  format: RecordingFormat;
  durationMs: number;
}

/** MediaRecorder wrapper: collects chunks every second and adds the duration WebM files lack. */
export class Recorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private format: RecordingFormat | null = null;

  get recording(): boolean {
    return this.recorder !== null;
  }

  get elapsedMs(): number {
    return this.recorder ? performance.now() - this.startedAt : 0;
  }

  start(stream: MediaStream, format: RecordingFormat, videoBitsPerSecond: number): void {
    if (this.recorder) return;
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: 128_000,
    });
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    recorder.start(1000);
    this.recorder = recorder;
    this.format = format;
    this.startedAt = performance.now();
  }

  async stop(): Promise<RecordingResult | null> {
    const recorder = this.recorder;
    const format = this.format;
    if (!recorder || !format) return null;
    this.recorder = null;
    const durationMs = performance.now() - this.startedAt;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => resolve();
      if (recorder.state === 'inactive') resolve();
      else recorder.stop();
    });
    let blob = new Blob(this.chunks, { type: recorder.mimeType || format.mimeType });
    this.chunks = [];
    if (needsDurationFix(blob.type)) {
      try {
        const { default: fixWebmDuration } = await import('fix-webm-duration');
        blob = await fixWebmDuration(blob, durationMs, { logger: false });
      } catch {
        // Keep the recording even if its duration cannot be added.
      }
    }
    return { blob, format, durationMs };
  }
}
