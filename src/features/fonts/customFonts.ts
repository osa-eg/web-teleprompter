import type { CustomFontFace, CustomFontRecord } from '@/storage/types';
import { customFamily } from './stack';

export const MAX_FONT_BYTES = 20 * 1024 * 1024;
export const FONT_ACCEPT = '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf';

/** Detects the font container from its magic bytes (falling back to the file extension). */
export function detectFontFormat(data: ArrayBuffer, fileName: string): CustomFontFace['format'] | null {
  const bytes = new Uint8Array(data, 0, Math.min(4, data.byteLength));
  const tag = String.fromCharCode(...bytes);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'opentype';
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0))
    return 'truetype';
  const ext = /\.(woff2|woff|ttf|otf)$/i.exec(fileName)?.[1]?.toLowerCase();
  if (ext === 'woff2' || ext === 'woff') return ext;
  if (ext === 'ttf') return 'truetype';
  if (ext === 'otf') return 'opentype';
  return null;
}

const WEIGHT_WORDS: [RegExp, number][] = [
  [/(hairline|thin)/, 100],
  [/(extra|ultra)[-_ ]?light/, 200],
  [/(semi|demi)[-_ ]?bold/, 600],
  [/(extra|ultra)[-_ ]?bold/, 800],
  [/(black|heavy)/, 900],
  [/light/, 300],
  [/medium/, 500],
  [/bold/, 700],
];

/** Guesses weight and style from a file name such as "Tajawal-ExtraBold.ttf". */
export function guessFace(fileName: string): { weight: number; style: 'normal' | 'italic' } {
  const name = fileName.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  const style = /(italic|oblique)/.test(name) ? 'italic' : 'normal';
  const numeric = /(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/.exec(name);
  if (numeric) return { weight: Number(numeric[1]), style };
  for (const [pattern, weight] of WEIGHT_WORDS) if (pattern.test(name)) return { weight, style };
  return { weight: 400, style };
}

/** Family name a user would recognise, derived from the file name ("Tajawal-Bold.ttf" → "Tajawal"). */
export function familyNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  const trimmed = base
    .replace(
      /(?:[-_ ]?(?:thin|hairline|extra[-_ ]?light|ultra[-_ ]?light|light|regular|book|normal|medium|semi[-_ ]?bold|demi[-_ ]?bold|bold|extra[-_ ]?bold|ultra[-_ ]?bold|black|heavy|italic|oblique|variable|vf|[1-9]00))+$/i,
      '',
    )
    .replace(/[-_]+/g, ' ')
    .trim();
  return trimmed || base;
}

const registered = new Map<string, FontFace[]>();

/**
 * Registers a stored font with the document (idempotent). `FontFace.load()` rejects invalid data,
 * which is how uploads are validated.
 */
export async function registerCustomFont(record: CustomFontRecord): Promise<void> {
  if (registered.has(record.id)) return;
  const faces = record.faces.map(
    (face) => new FontFace(record.family, face.data, { weight: String(face.weight), style: face.style }),
  );
  await Promise.all(faces.map((face) => face.load()));
  for (const face of faces) document.fonts.add(face);
  registered.set(record.id, faces);
}

export function unregisterCustomFont(id: string): void {
  for (const face of registered.get(id) ?? []) document.fonts.delete(face);
  registered.delete(id);
}

export function isRegistered(id: string): boolean {
  return registered.has(id);
}

/** Loads the data under a throwaway family name to check that the browser can use it. */
export async function validateFontData(data: ArrayBuffer): Promise<boolean> {
  try {
    const face = new FontFace(`tp-validate-${Math.random().toString(36).slice(2)}`, data);
    await face.load();
    return true;
  } catch {
    return false;
  }
}

let canvas: HTMLCanvasElement | null = null;
function measure(font: string, text: string): number {
  canvas ??= document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
}

/**
 * Whether `family` has glyphs for `text`: rendered with two different generic fallbacks, the width is
 * identical only when the family itself provides the glyphs.
 */
export function familyCovers(family: string, text: string): boolean {
  const quoted = `"${family.replace(/["\\]/g, '\\$&')}"`;
  const mono = measure(`72px ${quoted}, monospace`, text);
  const serif = measure(`72px ${quoted}, serif`, text);
  return mono > 0 && Math.abs(mono - serif) < 0.5;
}

export const ARABIC_PROBE = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';

export function newCustomFamily(id: string): string {
  return customFamily(id);
}
