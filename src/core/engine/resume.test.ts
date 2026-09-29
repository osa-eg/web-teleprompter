import { describe, expect, it } from 'vitest';
import { parseScript } from '../script/parse';
import { fingerprint, resolveResumePos } from './resume';

const body = Array.from({ length: 40 }, (_, i) => `كلمة${i} word${i}`).join('\n');

describe('resume position', () => {
  it('returns the saved position when the script is unchanged', () => {
    const doc = parseScript(body);
    const last = { pos: 30.5, fp: fingerprint(doc, 30.5) };
    expect(resolveResumePos(doc, last)).toBe(30.5);
  });

  it('follows the words when text was inserted before them', () => {
    const before = parseScript(body);
    const last = { pos: 30.25, fp: fingerprint(before, 30.25) };
    const after = parseScript(`مقدمة جديدة من خمس كلمات\n${body}`);
    expect(resolveResumePos(after, last)).toBeCloseTo(35.25);
  });

  it('clamps positions past the end and handles empty scripts', () => {
    const doc = parseScript('one two three');
    expect(resolveResumePos(doc, { pos: 99, fp: '' })).toBe(2);
    expect(resolveResumePos(parseScript(''), { pos: 5, fp: 'x' })).toBe(0);
  });

  it('ignores diacritics in fingerprints', () => {
    const plain = parseScript('على قدر أهل العزم');
    const voweled = parseScript('عَلى قَدْرِ أَهْلِ العَزْمِ');
    expect(fingerprint(plain, 0)).toBe(fingerprint(voweled, 0));
  });
});
