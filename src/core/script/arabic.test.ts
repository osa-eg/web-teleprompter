import { describe, expect, it } from 'vitest';
import { hasArabic, normalizeArabic, stripTashkeel, toArabicIndicDigits, toWesternDigits } from './arabic';

describe('arabic utilities', () => {
  it('strips diacritics but keeps letters', () => {
    expect(stripTashkeel('عَلى قَدْرِ أَهْلِ العَزْمِ')).toBe('على قدر أهل العزم');
  });

  it('detects Arabic text', () => {
    expect(hasArabic('Hello مرحبا')).toBe(true);
    expect(hasArabic('Hello world 123')).toBe(false);
  });

  it('converts digits both ways', () => {
    expect(toWesternDigits('٢٠٢٦ و ۱۲۳')).toBe('2026 و 123');
    expect(toArabicIndicDigits('Q1 2026')).toBe('Q١ ٢٠٢٦');
  });

  it('normalizes letter variants, tatweel, diacritics and presentation forms', () => {
    expect(normalizeArabic('أَحْمَد')).toBe('احمد');
    expect(normalizeArabic('إسلام آمن ٱلله')).toBe('اسلام امن الله');
    expect(normalizeArabic('مدرسة مستشفى')).toBe('مدرسه مستشفي');
    expect(normalizeArabic('مؤمن رئيس')).toBe('مومن رييس');
    expect(normalizeArabic('جـــميل')).toBe('جميل');
    expect(normalizeArabic('ﻣﺮﺣﺒﺎ')).toBe('مرحبا');
    expect(normalizeArabic('iPhone ١٧')).toBe('iphone 17');
  });
});
