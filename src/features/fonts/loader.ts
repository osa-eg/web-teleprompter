import type { FontRef } from '@/stores/settingsSchema';
import { useFonts } from '@/stores/fonts';
import { boldWeight, catalogFont, nearestWeight } from './catalog';
import { customFamily, quoteFamily } from './stack';

export type FontLoadResult = 'loaded' | 'system' | 'fallback';

const LOAD_TIMEOUT_MS = 5000;
const BASE_SAMPLE = 'اa';

/**
 * Characters to request from `document.fonts.load()`. Its default text is a single space, which only
 * matches the Latin face — with unicode-range subsets the Arabic file would never download.
 */
export function sampleText(text: string, limit = 400): string {
  const chars = new Set<string>(BASE_SAMPLE);
  for (const ch of text) {
    if (chars.size >= limit) break;
    if (!/\s/.test(ch)) chars.add(ch);
  }
  return [...chars].join('');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

/** Imports the stylesheet(s) a catalog font needs for the given weights. */
async function importCatalogCss(id: string, weights: number[]): Promise<string | null> {
  const font = catalogFont(id);
  if (!font) return null;
  if (font.variable) {
    await font.load.wght?.();
  } else {
    const wanted = new Set(weights.map((w) => nearestWeight(font.weights, w)));
    await Promise.all([...wanted].map((w) => font.load[String(w)]?.()));
  }
  return font.family;
}

/**
 * Makes sure a font is ready to render `sample` at `weights`: imports catalog CSS or registers an
 * uploaded font, then asks the browser to fetch the matching unicode-range subsets.
 */
export async function ensureFont(ref: FontRef, weights: number[], sample: string): Promise<FontLoadResult> {
  let family: string | null;
  switch (ref.kind) {
    case 'catalog':
      family = await importCatalogCss(ref.id, weights);
      break;
    case 'custom':
      family = (await useFonts.getState().ensureRegistered(ref.id)) ? customFamily(ref.id) : null;
      break;
    default:
      return 'system';
  }
  if (!family || typeof document === 'undefined' || !document.fonts) return family ? 'loaded' : 'fallback';

  const quoted = quoteFamily(family);
  const loads = Promise.all(weights.map((w) => document.fonts.load(`${w} 1em ${quoted}`, sample)));
  const result = await withTimeout(loads, LOAD_TIMEOUT_MS).catch(() => 'timeout' as const);
  if (result === 'timeout') return 'fallback';
  return result.every((faces) => faces.length > 0) ? 'loaded' : 'fallback';
}

/** Base and bold weights needed to render a script in this font. */
export function weightsFor(ref: FontRef, base: number): number[] {
  const font = ref.kind === 'catalog' ? catalogFont(ref.id) : undefined;
  const regular = font && !font.variable ? nearestWeight(font.weights, base) : base;
  return [...new Set([regular, boldWeight(font, base)])];
}
