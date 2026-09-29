import { CATALOG } from './catalog';

const RELEVANT_RANGE = /U\+0?600|U\+0000-00FF/i;

function unquote(family: string): string {
  return family.replace(/^["']|["']$/g, '');
}

/**
 * Downloads the Arabic and Latin files of every bundled font so the service worker caches them for
 * offline use. Other subsets (Cyrillic, Greek, Vietnamese…) are skipped.
 */
export async function cacheAllFonts(onProgress: (done: number, total: number) => void): Promise<void> {
  for (const font of CATALOG) {
    if (font.variable) await font.load.wght?.();
    else await Promise.all(font.weights.map((weight) => font.load[String(weight)]?.()));
  }
  const families = new Set(CATALOG.map((font) => font.family));
  const faces = [...document.fonts].filter(
    (face) => families.has(unquote(face.family)) && RELEVANT_RANGE.test(face.unicodeRange),
  );
  let done = 0;
  onProgress(done, faces.length);
  const queue = [...faces];
  const worker = async () => {
    for (let face = queue.shift(); face; face = queue.shift()) {
      await face.load().catch(() => undefined);
      onProgress(++done, faces.length);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
}
