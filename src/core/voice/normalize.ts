import { normalizeArabic } from '../script/arabic';
import { wordSegmenter } from '../script/stats';

const ch = (codePoint: number) => String.fromCodePoint(codePoint);
const ALEF = ch(0x0627);
const LAM = ch(0x0644);
const WAW = ch(0x0648);
const FEH = ch(0x0641);
const BEH = ch(0x0628);
const KAF = ch(0x0643);
const AL = ALEF + LAM;

/** Clitic prefixes, longest first: وال، فال، بال، كال، لل، ال، و، ف، ب. */
const PREFIXES = [WAW + AL, FEH + AL, BEH + AL, KAF + AL, LAM + LAM, AL, WAW, FEH, BEH];

const NOT_WORD_CHAR = /[^\p{L}\p{N}]/gu;

/**
 * Matching form of one word: presentation forms folded, diacritics and tatweel removed, alef/yeh/
 * teh-marbuta variants unified, digits Western, punctuation dropped, lower-cased.
 */
export function matchKey(word: string): string {
  return normalizeArabic(word).replace(NOT_WORD_CHAR, '');
}

/** The word without a leading conjunction/preposition/article (kept when too little would remain). */
export function stem(key: string): string {
  for (const prefix of PREFIXES) {
    if (key.startsWith(prefix) && key.length - prefix.length >= 2) return key.slice(prefix.length);
  }
  return key;
}

/** Splits recognized speech into matching keys. */
export function speechKeys(text: string, locale = 'ar'): string[] {
  const keys: string[] = [];
  for (const segment of wordSegmenter(locale).segment(text)) {
    if (!segment.isWordLike) continue;
    const key = matchKey(segment.segment);
    if (key) keys.push(key);
  }
  return keys;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** A word prepared for matching. */
export interface MatchWord {
  key: string;
  stem: string;
}

export function matchWord(text: string): MatchWord {
  const key = matchKey(text);
  return { key, stem: stem(key) };
}

/** 0…1 similarity of two words: exact, same stem (clitics differ), or close spelling. */
export function similarity(a: MatchWord, b: MatchWord): number {
  if (a.key === b.key) return 1;
  if (a.stem === b.stem) return 0.9;
  const length = Math.max(a.stem.length, b.stem.length);
  if (length < 3 || Math.abs(a.stem.length - b.stem.length) > 2) return 0;
  const ratio = 1 - levenshtein(a.stem, b.stem) / length;
  return ratio >= 0.7 ? ratio * 0.85 : 0;
}
