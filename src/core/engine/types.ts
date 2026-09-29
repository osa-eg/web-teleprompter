export type PlayState = 'idle' | 'countdown' | 'playing' | 'paused' | 'ended';
export type EndBehavior = 'stop' | 'loop' | 'scrollOut';

/**
 * Geometry of the rendered script, measured once per layout change.
 *
 * All positions are in "px space": the scroll offset at which a point sits on the reading line.
 * `lineP[k]` is the offset that centers visual line k on the reading line, so 0 means the first
 * line is centered on the guide.
 */
export interface LayoutModel {
  viewportH: number;
  readingY: number;
  dpr: number;
  lineHeightPx: number;
  tokenCount: number;
  /** Offset of every visual line that contains tokens (ascending). */
  lineP: Float64Array;
  /** First token index of every visual line (ascending, parallel to lineP). */
  lineTok: Int32Array;
  /** Offset of each block's first line. */
  blockP: Float64Array;
  markerP: Float64Array;
  cueP: Float64Array;
  /** Summed height of paragraph blocks (the spoken text). */
  paraHeight: number;
  /** Summed height of heading blocks. */
  headingHeight: number;
  /** Offset where the last line sits on the reading line. */
  endPx: number;
  /** Offset where the text has fully left the screen. */
  scrollOutPx: number;
}

export interface EngineConfig {
  wpm: number;
  rampMs: number;
  countdownSec: number;
  endBehavior: EndBehavior;
  autoPauseOnCues: boolean;
  pauseAtMarkers: boolean;
  headingsSpoken: boolean;
  /** When set, the speed is chosen so the whole script takes this long. */
  targetDurationSec: number | null;
  /** Words read aloud (paragraph words, plus heading words when headings are spoken). */
  spokenWords: number;
  /** Duration of every cue in document order (undefined = wait for the user). */
  cueSeconds: (number | undefined)[];
}

export interface EngineStatus {
  play: PlayState;
  /** Paused on a timed cue while playing. */
  holding: boolean;
  /** Continuous token index at the reading line. */
  pos: number;
  /** 0…1 */
  progress: number;
  /** Effective words per minute. */
  wpm: number;
  elapsedMs: number;
  remainingMs: number;
  /** Index of the current section marker, or -1 before the first one. */
  marker: number;
  /** Seconds left in the countdown, or null. */
  countdown: number | null;
  /** performance.now() when the snapshot was taken. */
  t: number;
}

export interface EngineHost {
  now(): number;
  raf(callback: (time: number) => void): number;
  caf(id: number): void;
}

export interface EngineSurface {
  measure(): LayoutModel;
  /** Moves the content so offset `px` is on the reading line. */
  apply(px: number): void;
}
