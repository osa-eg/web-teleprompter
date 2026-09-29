import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureFont } from './loader';

function mockFontSet(load: (font: string, text?: string) => Promise<FontFace[]>) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load, addEventListener: () => undefined, removeEventListener: () => undefined },
  });
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ensureFont', () => {
  it('imports the stylesheet and loads every weight with the sample text', async () => {
    const load = vi.fn(async () => [{} as FontFace]);
    mockFontSet(load);
    await expect(ensureFont({ kind: 'catalog', id: 'amiri' }, [400, 700], 'اa')).resolves.toBe('loaded');
    expect(load).toHaveBeenCalledWith('400 1em "Amiri"', 'اa');
    expect(load).toHaveBeenCalledWith('700 1em "Amiri"', 'اa');
  });

  it('reports a fallback when no face matches', async () => {
    mockFontSet(async () => []);
    await expect(ensureFont({ kind: 'catalog', id: 'cairo' }, [400], 'x')).resolves.toBe('fallback');
  });

  it('reports a fallback for unknown catalog fonts', async () => {
    mockFontSet(async () => [{} as FontFace]);
    await expect(ensureFont({ kind: 'catalog', id: 'nope' }, [400], 'x')).resolves.toBe('fallback');
  });

  it('does not load system fonts', async () => {
    const load = vi.fn(async () => []);
    mockFontSet(load);
    await expect(ensureFont({ kind: 'system', family: 'Tahoma' }, [400], 'x')).resolves.toBe('system');
    expect(load).not.toHaveBeenCalled();
  });

  it('gives up after a timeout', async () => {
    // Warm the stylesheet import so only the (faked) timer decides the outcome.
    await import('@fontsource/tajawal/400.css');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mockFontSet(() => new Promise(() => undefined));
    const result = ensureFont({ kind: 'catalog', id: 'tajawal' }, [400], 'x');
    let settled: string | null = null;
    void result.then((value) => (settled = value));
    for (let i = 0; i < 20 && settled === null; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(settled).toBe('fallback');
  });
});
