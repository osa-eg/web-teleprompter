import { useFonts } from '@/stores/fonts';
import type { Appearance, FontRef } from '@/stores/settingsSchema';
import { catalogFont } from './catalog';
import { buildFontStack, customFamily, SANS_FALLBACKS, SERIF_FALLBACKS } from './stack';
import { systemFontInfo } from './systemFonts';

export const DEFAULT_FONT: FontRef = { kind: 'catalog', id: 'cairo' };

export function resolveFamily(ref: FontRef): string | null {
  switch (ref.kind) {
    case 'catalog':
      return catalogFont(ref.id)?.family ?? null;
    case 'custom':
      return customFamily(ref.id);
    case 'system':
    case 'local':
      return ref.family;
  }
}

const SERIF_CATEGORIES = new Set(['naskh', 'ruqaa', 'nastaliq', 'serif']);

export function fontStackFor(appearance: Pick<Appearance, 'font' | 'latinFont'>): string {
  const category = appearance.font.kind === 'catalog' ? catalogFont(appearance.font.id)?.category : undefined;
  const fallbacks = category && SERIF_CATEGORIES.has(category) ? SERIF_FALLBACKS : SANS_FALLBACKS;
  return buildFontStack(appearance.font, appearance.latinFont, resolveFamily, fallbacks);
}

/** Recommended line height for a font (taller for scripts with diacritics such as naskh). */
export function recommendedLineHeight(ref: FontRef): number {
  switch (ref.kind) {
    case 'catalog':
      return catalogFont(ref.id)?.lineHeight ?? 1.6;
    case 'custom':
      return useFonts.getState().custom.find((f) => f.id === ref.id)?.hasArabic === false ? 1.5 : 1.8;
    default:
      return systemFontInfo(ref.family)?.lineHeight ?? 1.7;
  }
}

export function effectiveLineHeight(
  appearance: Pick<Appearance, 'font' | 'lineHeight' | 'lineHeightFromFont'>,
): number {
  return appearance.lineHeightFromFont ? recommendedLineHeight(appearance.font) : appearance.lineHeight;
}

/** Human-readable name of a font reference in the interface language. */
export function fontDisplayName(ref: FontRef, lang: 'ar' | 'en'): string {
  switch (ref.kind) {
    case 'catalog': {
      const font = catalogFont(ref.id);
      return font ? font.names[lang] : ref.id;
    }
    case 'custom':
      return useFonts.getState().custom.find((f) => f.id === ref.id)?.name ?? ref.id;
    default:
      return ref.family;
  }
}

/** Weights the user can choose: a range for variable fonts, a list for static ones. */
export function weightOptions(ref: FontRef): { min: number; max: number } | number[] {
  if (ref.kind === 'catalog') {
    const font = catalogFont(ref.id);
    if (font?.variable)
      return { min: Math.max(100, font.variable.min), max: Math.min(900, font.variable.max) };
    if (font) return font.weights;
  }
  if (ref.kind === 'custom') {
    const weights = useFonts.getState().custom.find((f) => f.id === ref.id)?.weights;
    if (weights?.length) return weights;
  }
  return { min: 100, max: 900 };
}

export function fontRefEquals(a: FontRef | null, b: FontRef | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'catalog' || a.kind === 'custom') return a.id === (b as typeof a).id;
  return a.family === (b as typeof a).family;
}
