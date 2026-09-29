import type { Appearance, FontRef } from '@/stores/settingsSchema';
import { buildFontStack, customFamily } from './stack';

/**
 * Fonts known to the app. The full catalog (46 Arabic + Latin families) arrives with the fonts
 * system; until then the bundled UI font and common system fonts are available.
 */
interface BasicFont {
  family: string;
  lineHeight: number;
}

const BUNDLED: Record<string, BasicFont> = {
  cairo: { family: 'Cairo Variable', lineHeight: 1.6 },
};

export function resolveFamily(ref: FontRef): string | null {
  switch (ref.kind) {
    case 'catalog':
      return BUNDLED[ref.id]?.family ?? null;
    case 'custom':
      return customFamily(ref.id);
    case 'system':
    case 'local':
      return ref.family;
  }
}

export function fontStackFor(appearance: Appearance): string {
  return buildFontStack(appearance.font, appearance.latinFont, resolveFamily);
}

/** Recommended line height for a font (taller for scripts with diacritics such as naskh). */
export function recommendedLineHeight(ref: FontRef): number {
  if (ref.kind === 'catalog') return BUNDLED[ref.id]?.lineHeight ?? 1.6;
  return 1.7;
}

export function effectiveLineHeight(appearance: Appearance): number {
  return appearance.lineHeightFromFont ? recommendedLineHeight(appearance.font) : appearance.lineHeight;
}

export const SYSTEM_FONT_CHOICES = [
  'Tahoma',
  'Arial',
  'Segoe UI',
  'Geeza Pro',
  'Traditional Arabic',
  'Simplified Arabic',
  'Sakkal Majalla',
  'Times New Roman',
  'Georgia',
] as const;
