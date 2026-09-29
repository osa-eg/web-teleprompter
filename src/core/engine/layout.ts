import type { LayoutModel } from './types';

export const EMPTY_MODEL: LayoutModel = {
  viewportH: 0,
  readingY: 0,
  dpr: 1,
  lineHeightPx: 1,
  tokenCount: 0,
  lineP: new Float64Array(0),
  lineTok: new Int32Array(0),
  blockP: new Float64Array(0),
  markerP: new Float64Array(0),
  cueP: new Float64Array(0),
  paraHeight: 0,
  headingHeight: 0,
  endPx: 0,
  scrollOutPx: 0,
};

/** Index of the last element of a sorted array that is <= value (or -1). */
export function lastIndexAtOrBelow(sorted: ArrayLike<number>, value: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= value) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Offset of the line after `k` (a virtual line below the last one). */
function nextLineP(model: LayoutModel, k: number): number {
  return k + 1 < model.lineP.length ? model.lineP[k + 1]! : model.lineP[k]! + model.lineHeightPx;
}

function nextLineTok(model: LayoutModel, k: number): number {
  return k + 1 < model.lineTok.length ? model.lineTok[k + 1]! : model.tokenCount;
}

/**
 * Scroll offset → continuous token position. Between two line centers the position moves linearly
 * from the first token of one line to the first token of the next.
 */
export function pxToPos(model: LayoutModel, px: number): number {
  const lines = model.lineP.length;
  if (lines === 0) return 0;
  const k = lastIndexAtOrBelow(model.lineP, px);
  if (k < 0) return model.lineTok[0]!;
  const startP = model.lineP[k]!;
  const endP = nextLineP(model, k);
  const startTok = model.lineTok[k]!;
  const frac = endP > startP ? Math.min(1, (px - startP) / (endP - startP)) : 0;
  return startTok + frac * (nextLineTok(model, k) - startTok);
}

/** Continuous token position → scroll offset (inverse of pxToPos). */
export function posToPx(model: LayoutModel, pos: number): number {
  const lines = model.lineTok.length;
  if (lines === 0) return 0;
  const k = lastIndexAtOrBelow(model.lineTok, pos);
  if (k < 0) return model.lineP[0]!;
  const startTok = model.lineTok[k]!;
  const endTok = nextLineTok(model, k);
  const startP = model.lineP[k]!;
  const frac = endTok > startTok ? Math.min(1, (pos - startTok) / (endTok - startTok)) : 0;
  return startP + frac * (nextLineP(model, k) - startP);
}

/** Snaps an offset to whole device pixels so glyphs stay crisp while scrolling slowly. */
export function snapToDevicePixels(px: number, dpr: number): number {
  return Math.round(px * dpr) / dpr;
}
