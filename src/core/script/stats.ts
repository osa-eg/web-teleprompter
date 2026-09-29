const segmenters = new Map<string, Intl.Segmenter>();

export function wordSegmenter(locale = 'ar'): Intl.Segmenter {
  let segmenter = segmenters.get(locale);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    segmenters.set(locale, segmenter);
  }
  return segmenter;
}

/** Counts word-like segments (Arabic words keep their attached clitics, e.g. «والكتاب» is one word). */
export function countWords(text: string): number {
  let count = 0;
  for (const segment of wordSegmenter().segment(text)) if (segment.isWordLike) count++;
  return count;
}

/** Estimated reading time in ms at `wpm` words per minute. */
export function estimateDurationMs(words: number, wpm: number): number {
  return wpm > 0 ? (words / wpm) * 60_000 : 0;
}
