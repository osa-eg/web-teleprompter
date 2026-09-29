export interface VadOptions {
  /** How far above the background noise the voice must be, in dB. */
  sensitivityDb: number;
  /** Speech must last this long to count (ignores clicks and bumps). */
  attackMs: number;
  /** Silence must last this long before scrolling stops (keeps short pauses between words). */
  releaseMs: number;
}

export const VAD_DEFAULTS: VadOptions = { sensitivityDb: 12, attackMs: 120, releaseMs: 700 };

const MIN_DB = -100;
/** Noise floor time constant while quiet, and how fast it may drop. */
const FLOOR_TAU_MS = 1500;

/** Signal level of a block of samples in dBFS. */
export function levelDb(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return rms > 0 ? Math.max(MIN_DB, 20 * Math.log10(rms)) : MIN_DB;
}

/**
 * Voice activity detection on a stream of levels: tracks the background noise floor and reports
 * speech when the level stays `sensitivityDb` above it for `attackMs`, until it stays below for
 * `releaseMs`. Offline, language-independent and cheap.
 */
export class VadMachine {
  private options: VadOptions;
  private floor: number | null = null;
  private speaking = false;
  private aboveSince: number | null = null;
  private belowSince: number | null = null;
  private last: number | null = null;
  private level = MIN_DB;

  constructor(options: Partial<VadOptions> = {}) {
    this.options = { ...VAD_DEFAULTS, ...options };
  }

  setOptions(options: Partial<VadOptions>): void {
    this.options = { ...this.options, ...options };
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get noiseFloor(): number {
    return this.floor ?? MIN_DB;
  }

  /** 0…1 for a level meter: 0 at the noise floor, 1 at twice the threshold. */
  get meter(): number {
    const above = this.level - this.noiseFloor;
    return Math.min(1, Math.max(0, above / (this.options.sensitivityDb * 2)));
  }

  /** Feeds one level (dBFS) measured at time `t` (ms); returns whether the person is speaking. */
  push(db: number, t: number): boolean {
    const dt = this.last === null ? 0 : Math.max(0, t - this.last);
    this.last = t;
    this.level = db;
    if (this.floor === null) this.floor = db;

    const above = db > this.floor + this.options.sensitivityDb;
    if (above) {
      this.belowSince = null;
      this.aboveSince ??= t;
      if (!this.speaking && t - this.aboveSince >= this.options.attackMs) this.speaking = true;
    } else {
      this.aboveSince = null;
      this.belowSince ??= t;
      if (this.speaking && t - this.belowSince >= this.options.releaseMs) this.speaking = false;
      // Follow the background: quickly down, slowly up (never while the voice is on).
      if (db < this.floor) this.floor += (db - this.floor) * (1 - Math.exp(-dt / (FLOOR_TAU_MS / 6)));
      else if (!this.speaking) this.floor += (db - this.floor) * (1 - Math.exp(-dt / FLOOR_TAU_MS));
    }
    return this.speaking;
  }
}
