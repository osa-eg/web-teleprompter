/**
 * Fonts that commonly ship with operating systems. They cannot be bundled; availability is detected
 * per device with a canvas measurement (`document.fonts.check()` cannot tell whether a local font is
 * installed — it returns true whenever no web font needs loading).
 */
export interface SystemFont {
  family: string;
  arabic: boolean;
  lineHeight: number;
}

export const SYSTEM_FONTS: SystemFont[] = [
  // Windows
  { family: 'Segoe UI', arabic: true, lineHeight: 1.6 },
  { family: 'Tahoma', arabic: true, lineHeight: 1.6 },
  { family: 'Arial', arabic: true, lineHeight: 1.6 },
  { family: 'Traditional Arabic', arabic: true, lineHeight: 2.0 },
  { family: 'Simplified Arabic', arabic: true, lineHeight: 1.8 },
  { family: 'Arabic Typesetting', arabic: true, lineHeight: 2.0 },
  { family: 'Sakkal Majalla', arabic: true, lineHeight: 1.9 },
  { family: 'Aldhabi', arabic: true, lineHeight: 2.0 },
  { family: 'Times New Roman', arabic: true, lineHeight: 1.7 },
  // Apple
  { family: 'Geeza Pro', arabic: true, lineHeight: 1.7 },
  { family: 'Al Nile', arabic: true, lineHeight: 1.8 },
  { family: 'Al Bayan', arabic: true, lineHeight: 1.7 },
  { family: 'Baghdad', arabic: true, lineHeight: 1.7 },
  { family: 'Damascus', arabic: true, lineHeight: 1.7 },
  { family: 'Farah', arabic: true, lineHeight: 1.8 },
  { family: 'Nadeem', arabic: true, lineHeight: 1.8 },
  { family: 'Muna', arabic: true, lineHeight: 1.8 },
  { family: 'Sana', arabic: true, lineHeight: 1.8 },
  { family: 'Waseem', arabic: true, lineHeight: 1.8 },
  { family: 'Diwan Thuluth', arabic: true, lineHeight: 2.2 },
  { family: 'Mishafi', arabic: true, lineHeight: 2.2 },
  // Android / Linux
  { family: 'Noto Naskh Arabic', arabic: true, lineHeight: 1.8 },
  { family: 'Noto Sans Arabic', arabic: true, lineHeight: 1.7 },
  { family: 'DejaVu Sans', arabic: true, lineHeight: 1.6 },
  // Latin
  { family: 'Georgia', arabic: false, lineHeight: 1.5 },
  { family: 'Verdana', arabic: false, lineHeight: 1.5 },
  { family: 'Helvetica Neue', arabic: false, lineHeight: 1.45 },
];

const systemByFamily = new Map(SYSTEM_FONTS.map((f) => [f.family.toLowerCase(), f]));

export function systemFontInfo(family: string): SystemFont | undefined {
  return systemByFamily.get(family.toLowerCase());
}

const PROBE = 'mmmmmmmmmwwwwwwwiiiiilllll ابجدهوز 0123';
let canvas: HTMLCanvasElement | null = null;

function width(font: string): number {
  canvas ??= document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(PROBE).width;
}

const availability = new Map<string, boolean>();

/** True when the family is installed (its text renders differently from every generic fallback). */
export function isFontInstalled(family: string): boolean {
  const cached = availability.get(family);
  if (cached !== undefined) return cached;
  const quoted = `"${family.replace(/["\\]/g, '\\$&')}"`;
  const installed = ['monospace', 'serif', 'sans-serif'].some(
    (generic) => Math.abs(width(`48px ${quoted}, ${generic}`) - width(`48px ${generic}`)) > 0.5,
  );
  availability.set(family, installed);
  return installed;
}
