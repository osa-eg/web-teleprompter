/**
 * Arabic text utilities shared by search, rendering options and voice matching.
 *
 * Character classes are built from code points so the source never contains invisible combining
 * marks or hard-to-review literal glyphs.
 */

const ch = (codePoint: number) => String.fromCodePoint(codePoint);
const span = (from: number, to: number) => `${ch(from)}-${ch(to)}`;

/** Harakat (U+064B–U+065F), superscript alef (U+0670) and Quranic annotation marks (U+06D6–U+06ED). */
export const TASHKEEL_RE = new RegExp(`[${span(0x064b, 0x065f)}${ch(0x0670)}${span(0x06d6, 0x06ed)}]`, 'g');
/** Tatweel / kashida (U+0640). */
const TATWEEL_RE = new RegExp(ch(0x0640), 'g');
/** Arabic, Arabic Supplement, Arabic Extended-A and the presentation-form blocks. */
const ARABIC_LETTER_RE = new RegExp(
  `[${span(0x0600, 0x06ff)}${span(0x0750, 0x077f)}${span(0x08a0, 0x08ff)}${span(0xfb50, 0xfdff)}${span(0xfe70, 0xfefc)}]`,
);
/** Arabic-Indic (U+0660–U+0669) and Extended Arabic-Indic (U+06F0–U+06F9) digits. */
const EASTERN_DIGITS_RE = new RegExp(`[${span(0x0660, 0x0669)}${span(0x06f0, 0x06f9)}]`, 'g');

/** Letter variants unified for matching: [pattern, replacement] as code points. */
const LETTER_FOLDS: [RegExp, string][] = [
  [new RegExp(`[${ch(0x0622)}${ch(0x0623)}${ch(0x0625)}${ch(0x0671)}]`, 'g'), ch(0x0627)], // alef forms → ا
  [new RegExp(ch(0x0649), 'g'), ch(0x064a)], // alef maqsura ى → ي
  [new RegExp(ch(0x0629), 'g'), ch(0x0647)], // ta marbuta ة → ه
  [new RegExp(ch(0x0624), 'g'), ch(0x0648)], // waw with hamza ؤ → و
  [new RegExp(ch(0x0626), 'g'), ch(0x064a)], // yeh with hamza ئ → ي
];

export function stripTashkeel(text: string): string {
  return text.replace(TASHKEEL_RE, '');
}

export function hasArabic(text: string): boolean {
  return ARABIC_LETTER_RE.test(text);
}

export function toWesternDigits(text: string): string {
  return text.replace(EASTERN_DIGITS_RE, (d) => String(d.charCodeAt(0) & 0xf));
}

/** 0–9 → Arabic-Indic digits (U+0660–U+0669). */
export function toArabicIndicDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => ch(0x0660 + Number(d)));
}

/**
 * Loose form used for search and speech matching: presentation forms folded (NFKC), diacritics and
 * tatweel removed, letter variants unified, digits converted to Western, lower-cased.
 */
export function normalizeArabic(text: string): string {
  let out = text.normalize('NFKC').replace(TASHKEEL_RE, '').replace(TATWEEL_RE, '');
  for (const [pattern, replacement] of LETTER_FOLDS) out = out.replace(pattern, replacement);
  return toWesternDigits(out).toLowerCase();
}
