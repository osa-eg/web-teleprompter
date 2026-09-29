import type { EngineConfig, LayoutModel } from './types';

export const MIN_WPM = 20;
export const MAX_WPM = 400;

export function clampWpm(wpm: number): number {
  return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(wpm)));
}

/**
 * Pixels of spoken text per word. Only paragraphs (and headings when read aloud) count, so gaps,
 * notes and cues scroll by at the same visual speed without changing the reading pace.
 */
export function pxPerWord(model: LayoutModel, config: EngineConfig): number {
  const height = model.paraHeight + (config.headingsSpoken ? model.headingHeight : 0);
  if (config.spokenWords > 0 && height > 0) return height / config.spokenWords;
  // No words: assume ~5 words per line.
  return model.lineHeightPx / 5;
}

/**
 * Automatic scroll speed in px/s. Words-per-minute keeps the reading pace independent of font size,
 * line height and margins; a target duration instead spreads the whole scroll over that time.
 */
export function autoVelocity(model: LayoutModel, config: EngineConfig, maxPx: number): number {
  if (config.targetDurationSec && config.targetDurationSec > 0) {
    return Math.max(maxPx, 1) / config.targetDurationSec;
  }
  return (config.wpm / 60) * pxPerWord(model, config);
}

/** Words per minute actually achieved by `velocity` (differs from config.wpm in target mode). */
export function effectiveWpm(velocity: number, model: LayoutModel, config: EngineConfig): number {
  const perWord = pxPerWord(model, config);
  return perWord > 0 ? (velocity / perWord) * 60 : config.wpm;
}

/** WPM needed to read `spokenWords` in `seconds`. */
export function wpmForDuration(spokenWords: number, seconds: number): number {
  return seconds > 0 ? (spokenWords / seconds) * 60 : 0;
}
