import { normalizeArabic } from '../script/arabic';
import type { ScriptDoc } from '../script/ast';

const FINGERPRINT_WORDS = 5;

/** Normalized text of the words at `pos`, used to re-find a reading position after edits. */
export function fingerprint(doc: ScriptDoc, pos: number): string {
  const words: string[] = [];
  for (let i = Math.max(0, Math.floor(pos)); i < doc.tokens.length && words.length < FINGERPRINT_WORDS; i++) {
    const token = doc.tokens[i]!;
    if (token.kind !== 'cue') words.push(normalizeArabic(token.text));
  }
  return words.join(' ');
}

/**
 * Resolves a saved reading position against the current script. When the text was edited, the
 * saved fingerprint is searched for within `radius` tokens so the reader lands on the same words.
 */
export function resolveResumePos(doc: ScriptDoc, last: { pos: number; fp: string }, radius = 300): number {
  const count = doc.tokens.length;
  if (count === 0) return 0;
  const pos = Math.min(Math.max(last.pos, 0), count - 1);
  if (!last.fp || fingerprint(doc, pos) === last.fp) return pos;
  const base = Math.floor(pos);
  const frac = pos - base;
  for (let distance = 1; distance <= radius; distance++) {
    for (const candidate of [base - distance, base + distance]) {
      if (candidate >= 0 && candidate < count && fingerprint(doc, candidate) === last.fp)
        return candidate + frac;
    }
  }
  return pos;
}
