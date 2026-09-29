import { CATALOG } from './catalog.generated';
import type { CatalogFont, FontCategory } from './catalogTypes';

export type { CatalogFont, FontCategory } from './catalogTypes';
export { CATALOG };

const byId = new Map(CATALOG.map((font) => [font.id, font]));

export function catalogFont(id: string): CatalogFont | undefined {
  return byId.get(id);
}

export const ARABIC_CATEGORIES = [
  'sans',
  'kufi',
  'naskh',
  'ruqaa',
  'nastaliq',
  'display',
  'handwriting',
] as const satisfies readonly FontCategory[];

export function isArabicFont(font: CatalogFont): boolean {
  return font.scripts.includes('arabic');
}

/** Fonts that only cover Latin (usable as the separate Latin font of a mixed script). */
export function isLatinOnly(font: CatalogFont): boolean {
  return !font.scripts.includes('arabic');
}

/** Available weight closest to `weight` (for static fonts). */
export function nearestWeight(weights: number[], weight: number): number {
  let best = weights[0] ?? 400;
  for (const candidate of weights) {
    if (Math.abs(candidate - weight) < Math.abs(best - weight)) best = candidate;
  }
  return best;
}

/** Weight used for **bold** text: +300 over the base, capped by what the font offers. */
export function boldWeight(font: CatalogFont | undefined, base: number): number {
  const target = Math.min(base + 300, 900);
  if (!font) return target;
  if (font.variable) return Math.min(target, font.variable.max);
  return nearestWeight(
    font.weights.filter((w) => w > base),
    target,
  );
}
