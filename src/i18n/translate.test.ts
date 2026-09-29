import { describe, expect, it } from 'vitest';
import { ar } from './ar';
import { en } from './en';
import { createFormatters } from './format';
import { createTranslator, localeFor } from './translate';

describe('translator', () => {
  it('interpolates params and formats numbers with the chosen digits', () => {
    expect(createTranslator('en')('library.noResults', { query: 'intro' })).toBe('No scripts match “intro”.');
    expect(createTranslator('ar', 'arab')('library.words', { count: 25 })).toBe('٢٥ كلمة');
    expect(createTranslator('ar', 'latn')('library.words', { count: 25 })).toBe('25 كلمة');
  });

  it('selects all six Arabic plural forms', () => {
    const t = createTranslator('ar');
    expect(t('library.words', { count: 0 })).toBe('لا توجد كلمات');
    expect(t('library.words', { count: 1 })).toBe('كلمة واحدة');
    expect(t('library.words', { count: 2 })).toBe('كلمتان');
    expect(t('library.words', { count: 3 })).toBe('3 كلمات');
    expect(t('library.words', { count: 10 })).toBe('10 كلمات');
    expect(t('library.words', { count: 11 })).toBe('11 كلمة');
    expect(t('library.words', { count: 99 })).toBe('99 كلمة');
    expect(t('library.words', { count: 100 })).toBe('100 كلمة');
  });

  it('uses English plural rules', () => {
    const t = createTranslator('en');
    expect(t('library.words', { count: 1 })).toBe('1 word');
    expect(t('library.words', { count: 2 })).toBe('2 words');
  });

  it('keeps unknown placeholders intact', () => {
    expect(createTranslator('en')('library.duration', {})).toBe('≈ {duration}');
  });

  it('has the same keys in both languages', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it('builds locales with an explicit numbering system', () => {
    expect(localeFor('ar', 'arab')).toBe('ar-u-nu-arab');
    expect(localeFor('ar', 'latn')).toBe('ar-u-nu-latn');
    expect(localeFor('en', 'arab')).toBe('en-u-nu-latn');
  });
});

describe('formatters', () => {
  it('formats durations as clock values', () => {
    const fmt = createFormatters('en');
    expect(fmt.duration(0)).toBe('0:00');
    expect(fmt.duration(65_000)).toBe('1:05');
    expect(fmt.duration(3_725_000)).toBe('1:02:05');
    expect(createFormatters('ar', 'arab').duration(65_000)).toBe('١:٠٥');
  });

  it('formats relative times', () => {
    const fmt = createFormatters('en');
    const now = Date.UTC(2026, 0, 10);
    expect(fmt.relative(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(fmt.relative(now - 86_400_000, now)).toBe('yesterday');
  });
});
