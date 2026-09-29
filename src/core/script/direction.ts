import type { Dir } from './ast';

const RLM = String.fromCodePoint(0x200f);
const ALM = String.fromCodePoint(0x061c);
const LRM = String.fromCodePoint(0x200e);

/** Letters of right-to-left scripts. */
const RTL_LETTER =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
const LETTER = /\p{L}/u;

export type StrongDir = Dir | null;

/** Direction of the first strong (letter) character, or null when there is none. */
export function firstStrongDir(text: string): StrongDir {
  for (const ch of text) {
    if (RTL_LETTER.test(ch)) return 'rtl';
    if (LETTER.test(ch)) return 'ltr';
  }
  return null;
}

/** Explicit direction mark at the start of a line (RLM/ALM → rtl, LRM → ltr). */
export function leadingMarkDir(text: string): StrongDir {
  const first = text.trimStart()[0];
  if (first === RLM || first === ALM) return 'rtl';
  if (first === LRM) return 'ltr';
  return null;
}

export interface DirCounts {
  rtl: number;
  ltr: number;
}

/** Counts words by the direction of their first strong character. */
export function countDirWords(text: string): DirCounts {
  const counts: DirCounts = { rtl: 0, ltr: 0 };
  for (const word of text.split(/\s+/)) {
    const dir = firstStrongDir(word);
    if (dir) counts[dir]++;
  }
  return counts;
}

/**
 * Resolves a line's direction: an explicit leading RLM/ALM/LRM wins; otherwise the majority of its
 * words decides (so «iPhone 17 هو أحدث هاتف» is right-to-left, unlike the browser's first-strong
 * `dir="auto"`); a tie falls back to the first strong character; a line without letters inherits.
 */
export function detectLineDir(text: string, inherit: Dir): Dir {
  const mark = leadingMarkDir(text);
  if (mark) return mark;
  const { rtl, ltr } = countDirWords(text);
  if (rtl > ltr) return 'rtl';
  if (ltr > rtl) return 'ltr';
  return firstStrongDir(text) ?? inherit;
}

export function toggleLineMark(line: string): string {
  const trimmed = line.trimStart();
  const indent = line.slice(0, line.length - trimmed.length);
  const first = trimmed[0];
  if (first === RLM || first === ALM) return indent + LRM + trimmed.slice(1);
  if (first === LRM) return indent + trimmed.slice(1);
  return indent + RLM + trimmed;
}

export const DIRECTION_MARKS = { RLM, ALM, LRM } as const;
