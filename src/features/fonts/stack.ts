import type { FontRef } from '@/stores/settingsSchema';

/** Generic fallbacks that cover Arabic and Latin on every major platform. */
export const SANS_FALLBACKS = ['Segoe UI', 'Tahoma', 'Geeza Pro', 'Noto Naskh Arabic', 'Arial', 'sans-serif'];
export const SERIF_FALLBACKS = ['Times New Roman', 'Traditional Arabic', 'Noto Naskh Arabic', 'serif'];

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'math']);

/** Quotes a family name for use in `font-family` (generic keywords stay bare). */
export function quoteFamily(family: string): string {
  if (GENERIC.has(family)) return family;
  return `"${family.replace(/["\\]/g, '\\$&')}"`;
}

/** CSS family name for a custom (uploaded) font. */
export function customFamily(id: string): string {
  return `tp-u-${id}`;
}

export type FamilyResolver = (ref: FontRef) => string | null;

/**
 * Builds a `font-family` value: optional Latin-only font first (Arabic glyphs fall through to the
 * primary font), then the primary font, then platform fallbacks.
 */
export function buildFontStack(
  primary: FontRef,
  latin: FontRef | null,
  resolve: FamilyResolver,
  fallbacks: string[] = SANS_FALLBACKS,
): string {
  const families: string[] = [];
  const add = (family: string | null) => {
    if (family && !families.includes(family)) families.push(family);
  };
  if (latin) add(resolve(latin));
  add(resolve(primary));
  for (const family of fallbacks) add(family);
  return families.map(quoteFamily).join(', ');
}
