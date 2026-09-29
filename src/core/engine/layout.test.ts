import { describe, expect, it } from 'vitest';
import { EMPTY_MODEL, lastIndexAtOrBelow, posToPx, pxToPos, snapToDevicePixels } from './layout';
import { makeModel } from './testing';

describe('position mapping', () => {
  const model = makeModel({ lines: 10, tokensPerLine: 4, lineHeight: 50 });

  it('maps line centers to their first token', () => {
    expect(pxToPos(model, 0)).toBe(0);
    expect(pxToPos(model, 50)).toBe(4);
    expect(pxToPos(model, 450)).toBe(36);
  });

  it('interpolates between lines', () => {
    expect(pxToPos(model, 25)).toBe(2);
    expect(pxToPos(model, 60)).toBeCloseTo(4.8);
  });

  it('round-trips positions and offsets', () => {
    for (const px of [0, 13, 50, 77.5, 200, 449, 470]) {
      expect(posToPx(model, pxToPos(model, px))).toBeCloseTo(Math.min(px, 500), 6);
    }
  });

  it('clamps before the first line and after the last token', () => {
    const shifted = { ...model, lineP: model.lineP.map((p) => p + 100) };
    expect(pxToPos(shifted, 0)).toBe(0);
    expect(posToPx(model, 1000)).toBe(500);
  });

  it('keeps the same words at the reading line when the layout reflows', () => {
    // Doubling the font size: twice the line height, half the words per line.
    const before = makeModel({ lines: 20, tokensPerLine: 6, lineHeight: 40 });
    const after = makeModel({ lines: 40, tokensPerLine: 3, lineHeight: 80 });
    const pos = pxToPos(before, 333);
    const px = posToPx(after, pos);
    expect(pxToPos(after, px)).toBeCloseTo(pos, 6);
    expect(Math.floor(pxToPos(after, px))).toBe(Math.floor(pos));
  });

  it('handles an empty layout', () => {
    expect(pxToPos(EMPTY_MODEL, 100)).toBe(0);
    expect(posToPx(EMPTY_MODEL, 5)).toBe(0);
  });

  it('binary-searches sorted arrays', () => {
    const sorted = [0, 10, 20, 30];
    expect(lastIndexAtOrBelow(sorted, -1)).toBe(-1);
    expect(lastIndexAtOrBelow(sorted, 0)).toBe(0);
    expect(lastIndexAtOrBelow(sorted, 25)).toBe(2);
    expect(lastIndexAtOrBelow(sorted, 99)).toBe(3);
  });

  it.each([1, 1.25, 1.5, 2, 3])('snaps to whole device pixels at dpr %s', (dpr) => {
    for (const px of [0.1, 10.37, 99.99, 1234.5678]) {
      const snapped = snapToDevicePixels(px, dpr);
      expect(Math.abs(snapped * dpr - Math.round(snapped * dpr))).toBeLessThan(1e-9);
      expect(Math.abs(snapped - px)).toBeLessThanOrEqual(0.5 / dpr + 1e-9);
    }
  });
});
