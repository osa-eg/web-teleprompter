import { describe, expect, it } from 'vitest';
import { countDirWords, detectLineDir, DIRECTION_MARKS, firstStrongDir, toggleLineMark } from './direction';

const { RLM, LRM, ALM } = DIRECTION_MARKS;

describe('line direction', () => {
  it('uses the majority of words, not the first letter', () => {
    expect(detectLineDir('iPhone 17 هو أحدث هاتف من شركة Apple', 'ltr')).toBe('rtl');
    expect(detectLineDir('مرحبا Hello world, how are you?', 'rtl')).toBe('ltr');
  });

  it('handles pure scripts', () => {
    expect(detectLineDir('مرحباً بكم جميعاً', 'ltr')).toBe('rtl');
    expect(detectLineDir('Hello everyone', 'rtl')).toBe('ltr');
    expect(detectLineDir('שלום עולם', 'ltr')).toBe('rtl');
  });

  it('breaks ties with the first strong character', () => {
    expect(detectLineDir('Apple تفاحة', 'rtl')).toBe('ltr');
    expect(detectLineDir('تفاحة Apple', 'ltr')).toBe('rtl');
  });

  it('inherits when there are no letters', () => {
    expect(detectLineDir('2026 — 25%', 'rtl')).toBe('rtl');
    expect(detectLineDir('...', 'ltr')).toBe('ltr');
  });

  it('honours explicit direction marks', () => {
    expect(detectLineDir(`${RLM}Hello world`, 'ltr')).toBe('rtl');
    expect(detectLineDir(`${ALM}Hello world`, 'ltr')).toBe('rtl');
    expect(detectLineDir(`${LRM}مرحبا بكم`, 'rtl')).toBe('ltr');
    expect(detectLineDir(`  ${LRM}مرحبا بكم`, 'rtl')).toBe('ltr');
  });

  it('counts words by their first strong character', () => {
    expect(countDirWords('هو iPhone و Galaxy 17')).toEqual({ rtl: 2, ltr: 2 });
    expect(firstStrongDir('123 abc')).toBe('ltr');
    expect(firstStrongDir('123 ...')).toBeNull();
  });

  it('cycles the leading mark: none → RLM → LRM → none', () => {
    const once = toggleLineMark('Hello');
    expect(once).toBe(`${RLM}Hello`);
    const twice = toggleLineMark(once);
    expect(twice).toBe(`${LRM}Hello`);
    expect(toggleLineMark(twice)).toBe('Hello');
    expect(toggleLineMark('  indented')).toBe(`  ${RLM}indented`);
  });
});
