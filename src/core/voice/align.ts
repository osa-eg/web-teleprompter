import type { ScriptDoc } from '../script/ast';
import { matchWord, similarity, type MatchWord } from './normalize';

export interface ScriptWord extends MatchWord {
  /** Positional token index in the script. */
  token: number;
}

/** The words a speaker may say, in order (paragraph and heading words; not cues or notes). */
export function scriptWords(doc: ScriptDoc): ScriptWord[] {
  const words: ScriptWord[] = [];
  for (const token of doc.tokens) {
    if (token.kind === 'cue') continue;
    const word = matchWord(token.text);
    if (word.key) words.push({ token: token.i, ...word });
  }
  return words;
}

const MATCH = 2;
const MISMATCH = -1;
/** A script word the speaker (or the recognizer) skipped. */
const SKIP_SCRIPT = -0.6;
/** A recognized word that is not in the script. */
const SKIP_HEARD = -1;
/** How many of the latest recognized words are aligned. */
export const MAX_HEARD = 8;

export interface AlignerOptions {
  /** Search window around the current word, in words. */
  behind: number;
  ahead: number;
  /** Final results may also find the speaker further back (a sentence read again). */
  finalBehind: number;
  /** Wider window used after repeated misses (the speaker jumped). */
  wideBehind: number;
  wideAhead: number;
  /** Misses before the window widens. */
  missesToWiden: number;
}

const DEFAULTS: AlignerOptions = {
  behind: 5,
  ahead: 60,
  finalBehind: 40,
  wideBehind: 80,
  wideAhead: 250,
  missesToWiden: 3,
};

/**
 * Follows a speaker through the script from speech-recognition results: the latest heard words are
 * aligned against a window of script words with Smith–Waterman (fuzzy word similarity, cheap skips
 * for dropped words). Interim results may only move forward; moving back needs a strong final
 * result. Repeated phrases resolve to the nearest occurrence ahead.
 */
export class SpeechAligner {
  private readonly words: ScriptWord[];
  private readonly options: AlignerOptions;
  /** Index (in `words`) of the last word spoken, -1 before the first. */
  private current = -1;
  private misses = 0;

  constructor(words: ScriptWord[], options: Partial<AlignerOptions> = {}) {
    this.words = words;
    this.options = { ...DEFAULTS, ...options };
  }

  /** Token of the last word spoken, or -1. */
  get token(): number {
    return this.words[this.current]?.token ?? -1;
  }

  /** The reader moved (seek, jump, click on a word): continue from the word before `tokenPos`. */
  resync(tokenPos: number): void {
    let lo = 0;
    let hi = this.words.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.words[mid]!.token < tokenPos) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    this.current = found;
    this.misses = 0;
  }

  /**
   * Aligns the latest heard words. Returns the token of the word just spoken, or null when the
   * words could not be placed confidently (or would move back on an interim result).
   */
  match(heard: readonly MatchWord[], final: boolean): number | null {
    const recent = heard.slice(-MAX_HEARD);
    const n = recent.length;
    if (n === 0 || this.words.length === 0) return null;
    const { behind, ahead, finalBehind, wideBehind, wideAhead, missesToWiden } = this.options;
    const wide = this.misses >= missesToWiden;

    // Short utterances are ambiguous: only look just ahead and demand a clean match.
    let lo: number;
    let hi: number;
    if (n < 3) {
      lo = this.current + 1;
      hi = Math.min(this.words.length, this.current + 9);
    } else {
      lo = Math.max(0, this.current - (wide ? wideBehind : final ? finalBehind : behind));
      hi = Math.min(this.words.length, this.current + 1 + (wide ? wideAhead : ahead));
    }
    const m = hi - lo;
    if (m <= 0) return null;

    // Smith–Waterman over (heard × window), keeping two rows.
    let prev = new Float64Array(m + 1);
    let lastRow = prev;
    let beforeLast = prev;
    for (let i = 1; i <= n; i++) {
      const row = new Float64Array(m + 1);
      const word = recent[i - 1]!;
      for (let j = 1; j <= m; j++) {
        const sim = similarity(word, this.words[lo + j - 1]!);
        const diag = prev[j - 1]! + (sim > 0 ? MATCH * sim : MISMATCH);
        row[j] = Math.max(0, diag, prev[j]! + SKIP_HEARD, row[j - 1]! + SKIP_SCRIPT);
      }
      beforeLast = prev;
      prev = row;
      lastRow = row;
    }

    // The alignment must end on the last heard word (or the one before, which is often an unfinished
    // interim word) matching a script word.
    let best = -1;
    let bestScore = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;
    const consider = (row: Float64Array, word: MatchWord, penalty: number) => {
      for (let j = 1; j <= m; j++) {
        if (similarity(word, this.words[lo + j - 1]!) <= 0) continue;
        const score = row[j]! - penalty;
        const index = lo + j - 1;
        const distance = index - this.current;
        const adjusted = score - (distance >= 0 ? 0.01 * distance : 0.05 * -distance);
        if (adjusted > bestAdjusted) {
          bestAdjusted = adjusted;
          bestScore = score;
          best = index;
        }
      }
    };
    consider(lastRow, recent[n - 1]!, 0);
    if (n >= 2) consider(beforeLast, recent[n - 2]!, 1);

    const required = n < 3 ? MATCH * n * 0.85 : MATCH * 3 * 0.7;
    const backwards = best < this.current;
    const strong = n >= 3 && bestScore >= MATCH * Math.min(n, 5) * 0.8;
    if (best < 0 || bestScore < required || (backwards && (!final || !strong))) {
      if (n >= 3) this.misses++;
      return null;
    }
    this.current = best;
    this.misses = 0;
    return this.words[best]!.token;
  }
}
