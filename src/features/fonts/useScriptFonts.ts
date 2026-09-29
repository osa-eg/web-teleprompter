import { useEffect, useMemo, useState } from 'react';
import type { Appearance } from '@/stores/settingsSchema';
import { useFonts } from '@/stores/fonts';
import { ensureFont, sampleText, weightsFor, type FontLoadResult } from './loader';

export type FontStatus = FontLoadResult | 'loading';

/**
 * Loads the fonts an appearance needs for `text` (its actual characters decide which unicode-range
 * subsets are fetched). Returns 'loading' until they are ready.
 */
export function useScriptFonts(
  appearance: Pick<Appearance, 'font' | 'latinFont' | 'weight'>,
  text: string,
): FontStatus {
  const sample = useMemo(() => sampleText(text), [text]);
  // Custom fonts are resolved from the fonts store, so wait until it has loaded.
  const fontsReady = useFonts((s) => s.status === 'ready');
  const key = JSON.stringify([appearance.font, appearance.latinFont, appearance.weight, sample, fontsReady]);
  const [state, setState] = useState<{ key: string; status: FontLoadResult } | null>(null);

  useEffect(() => {
    void useFonts.getState().init();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refs = [appearance.font, appearance.latinFont].filter((ref) => ref !== null);
    void Promise.all(refs.map((ref) => ensureFont(ref, weightsFor(ref, appearance.weight), sample))).then(
      (results) => {
        if (cancelled) return;
        const status: FontLoadResult = results.includes('fallback')
          ? 'fallback'
          : results.every((r) => r === 'system')
            ? 'system'
            : 'loaded';
        setState({ key, status });
      },
    );
    return () => {
      cancelled = true;
    };
    // `key` captures every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state?.key === key ? state.status : 'loading';
}
