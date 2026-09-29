import { describe, expect, it } from 'vitest';
import {
  ARABIC_CATEGORIES,
  boldWeight,
  CATALOG,
  catalogFont,
  isArabicFont,
  isLatinOnly,
  nearestWeight,
} from './catalog';
import { detectFontFormat, familyNameFromFile, guessFace } from './customFonts';
import {
  effectiveLineHeight,
  fontStackFor,
  recommendedLineHeight,
  resolveFamily,
  weightOptions,
} from './fontSettings';
import { sampleText, weightsFor } from './loader';
import { buildFontStack, quoteFamily } from './stack';

describe('font catalog', () => {
  it('has unique ids and families', () => {
    expect(new Set(CATALOG.map((f) => f.id)).size).toBe(CATALOG.length);
    expect(new Set(CATALOG.map((f) => f.family)).size).toBe(CATALOG.length);
  });

  it('ships 46 Arabic fonts, each with the Arabic subset', () => {
    const arabic = CATALOG.filter(isArabicFont);
    expect(arabic).toHaveLength(46);
    for (const font of arabic) expect(ARABIC_CATEGORIES).toContain(font.category);
  });

  it('has a loader for every font and weight', () => {
    for (const font of CATALOG) {
      if (font.variable) {
        expect(typeof font.load.wght).toBe('function');
        expect(font.family.endsWith(' Variable')).toBe(true);
      } else {
        for (const weight of font.weights) expect(typeof font.load[String(weight)]).toBe('function');
      }
      expect(font.lineHeight).toBeGreaterThanOrEqual(1.2);
      expect(font.lineHeight).toBeLessThanOrEqual(3);
    }
  });

  it('gives naskh and nastaliq fonts taller lines than modern ones', () => {
    expect(catalogFont('amiri')!.lineHeight).toBeGreaterThan(catalogFont('cairo')!.lineHeight);
    expect(catalogFont('noto-nastaliq-urdu')!.lineHeight).toBeGreaterThan(catalogFont('amiri')!.lineHeight);
  });

  it('separates Latin-only fonts', () => {
    expect(isLatinOnly(catalogFont('inter')!)).toBe(true);
    expect(isLatinOnly(catalogFont('cairo')!)).toBe(false);
  });

  it('picks weights available in static fonts', () => {
    expect(nearestWeight([400, 700], 600)).toBe(700);
    expect(nearestWeight([400, 700], 500)).toBe(400);
    expect(boldWeight(catalogFont('amiri'), 400)).toBe(700);
    expect(boldWeight(catalogFont('cairo'), 600)).toBe(900);
    expect(weightsFor({ kind: 'catalog', id: 'amiri' }, 500)).toEqual([400, 700]);
    expect(weightsFor({ kind: 'catalog', id: 'cairo' }, 500)).toEqual([500, 800]);
  });
});

describe('font stack', () => {
  it('quotes and escapes family names', () => {
    expect(quoteFamily('Cairo Variable')).toBe('"Cairo Variable"');
    expect(quoteFamily('sans-serif')).toBe('sans-serif');
    expect(quoteFamily('Bad "Name"')).toBe('"Bad \\"Name\\""');
  });

  it('puts the Latin font first so Arabic falls through to the main font', () => {
    const stack = fontStackFor({
      font: { kind: 'catalog', id: 'amiri' },
      latinFont: { kind: 'catalog', id: 'inter' },
    });
    expect(stack.startsWith('"Inter Variable", "Amiri"')).toBe(true);
    expect(stack).toContain('serif');
  });

  it('deduplicates families and resolves every kind of font', () => {
    const stack = buildFontStack({ kind: 'system', family: 'Tahoma' }, null, resolveFamily);
    expect(stack.match(/Tahoma/g)).toHaveLength(1);
    expect(resolveFamily({ kind: 'custom', id: 'abc' })).toBe('tp-u-abc');
    expect(resolveFamily({ kind: 'local', family: 'My Font' })).toBe('My Font');
    expect(resolveFamily({ kind: 'catalog', id: 'missing' })).toBeNull();
  });
});

describe('line height and weights', () => {
  it('uses the font recommendation unless overridden', () => {
    const base = { font: { kind: 'catalog', id: 'amiri' } as const, lineHeight: 1.3 };
    expect(effectiveLineHeight({ ...base, lineHeightFromFont: true })).toBe(2);
    expect(effectiveLineHeight({ ...base, lineHeightFromFont: false })).toBe(1.3);
    expect(recommendedLineHeight({ kind: 'system', family: 'Traditional Arabic' })).toBe(2);
    expect(recommendedLineHeight({ kind: 'system', family: 'Unknown Font' })).toBe(1.7);
  });

  it('offers a range for variable fonts and a list for static ones', () => {
    expect(weightOptions({ kind: 'catalog', id: 'cairo' })).toEqual({ min: 200, max: 900 });
    expect(weightOptions({ kind: 'catalog', id: 'amiri' })).toEqual([400, 700]);
  });
});

describe('custom font files', () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0]).buffer;
  const text = (tag: string) => new TextEncoder().encode(`${tag}rest`).buffer;

  it('detects formats from magic bytes', () => {
    expect(detectFontFormat(text('wOF2'), 'x.bin')).toBe('woff2');
    expect(detectFontFormat(text('wOFF'), 'x.bin')).toBe('woff');
    expect(detectFontFormat(text('OTTO'), 'x.bin')).toBe('opentype');
    expect(detectFontFormat(bytes(0, 1, 0, 0), 'x.bin')).toBe('truetype');
    expect(detectFontFormat(text('????'), 'font.otf')).toBe('opentype');
    expect(detectFontFormat(text('????'), 'readme.txt')).toBeNull();
  });

  it('guesses weight and style from file names', () => {
    expect(guessFace('Tajawal-ExtraBold.ttf')).toEqual({ weight: 800, style: 'normal' });
    expect(guessFace('Amiri-BoldItalic.ttf')).toEqual({ weight: 700, style: 'italic' });
    expect(guessFace('MyFont-SemiBold.otf')).toEqual({ weight: 600, style: 'normal' });
    expect(guessFace('Font_300.woff2')).toEqual({ weight: 300, style: 'normal' });
    expect(guessFace('Regular.ttf')).toEqual({ weight: 400, style: 'normal' });
    expect(guessFace('Thin.ttf').weight).toBe(100);
  });

  it('derives the family name from file names', () => {
    expect(familyNameFromFile('Tajawal-ExtraBold.ttf')).toBe('Tajawal');
    expect(familyNameFromFile('My_Arabic_Font-Regular.woff2')).toBe('My Arabic Font');
    expect(familyNameFromFile('Bold.ttf')).toBe('Bold');
    expect(familyNameFromFile('lalezar-arabic-400-normal.woff2')).toBe('lalezar arabic');
    expect(familyNameFromFile('Amiri-BoldItalic.ttf')).toBe('Amiri');
  });
});

describe('font loading sample', () => {
  it('always includes Arabic and Latin letters and skips spaces', () => {
    const sample = sampleText('Hello  مرحبا');
    expect(sample).toContain('ا');
    expect(sample).toContain('a');
    expect(sample).not.toContain(' ');
    expect(new Set(sample).size).toBe(sample.length);
  });

  it('caps the sample length', () => {
    const text = Array.from({ length: 2000 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('');
    expect([...sampleText(text, 50)]).toHaveLength(50);
  });
});
