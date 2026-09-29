import { describe, expect, it } from 'vitest';
import { parseScript } from '../script/parse';
import { scriptWords, SpeechAligner } from './align';
import { matchKey, matchWord, similarity, speechKeys, stem } from './normalize';
import { levelDb, VadMachine } from './vad';

const heard = (text: string) => speechKeys(text).map(matchWord);

function aligner(body: string) {
  const doc = parseScript(body, { direction: 'auto', fallbackDir: 'rtl' });
  const words = scriptWords(doc);
  const tokenOf = (text: string, nth = 0) => {
    const key = matchKey(text);
    const found = words.filter((w) => w.key === key);
    return found[nth]!.token;
  };
  return { doc, words, tokenOf, aligner: new SpeechAligner(words) };
}

describe('voice matching keys', () => {
  it('normalizes Arabic spelling variants, diacritics, digits and punctuation', () => {
    expect(matchKey('إِنَّ')).toBe(matchKey('ان'));
    expect(matchKey('الكِتَابُ،')).toBe('الكتاب');
    expect(matchKey('مدرسة')).toBe(matchKey('مدرسه'));
    expect(matchKey('على')).toBe(matchKey('علي'));
    expect(matchKey('مسؤول')).toBe(matchKey('مسوول'));
    expect(matchKey('٢٠٢٦')).toBe('2026');
    expect(matchKey('«مرحباً»')).toBe('مرحبا');
    expect(matchKey('Hello!')).toBe('hello');
    expect(matchKey('ﻣﺮﺣﺒﺎ')).toBe('مرحبا'); // presentation forms
  });

  it('strips clitic prefixes for a second chance', () => {
    expect(stem(matchKey('والكتاب'))).toBe(stem(matchKey('الكتاب')));
    expect(stem(matchKey('بالمدرسة'))).toBe('مدرسه');
    expect(stem(matchKey('وهو'))).toBe('هو');
    expect(stem('من')).toBe('من'); // too short to strip
  });

  it('scores similar words', () => {
    expect(similarity(matchWord('الكتاب'), matchWord('الكتاب'))).toBe(1);
    expect(similarity(matchWord('والكتاب'), matchWord('الكتاب'))).toBe(0.9);
    expect(similarity(matchWord('المعلومات'), matchWord('المعلومة'))).toBeGreaterThan(0.5);
    expect(similarity(matchWord('شمس'), matchWord('قمر'))).toBe(0);
  });

  it('splits recognized speech into words', () => {
    expect(speechKeys('مرحباً، كيف حالك؟')).toEqual(['مرحبا', 'كيف', 'حالك']);
  });
});

const SCRIPT = [
  'مرحباً بكم في برنامجنا اليومي عن التقنية الحديثة.',
  'نتحدث اليوم عن الذكاء الاصطناعي وأثره في حياتنا.',
  'ثم ننتقل إلى أخبار الهواتف الذكية والحواسيب.',
  'وفي الختام نستعرض أسئلة المشاهدين الكرام.',
].join('\n');

describe('SpeechAligner', () => {
  it('follows exact reading', () => {
    const { aligner: a, tokenOf } = aligner(SCRIPT);
    expect(a.match(heard('مرحبا بكم في'), false)).toBe(tokenOf('في'));
    expect(a.match(heard('مرحبا بكم في برنامجنا اليومي'), true)).toBe(tokenOf('اليومي'));
  });

  it('matches despite diacritics and spelling variants', () => {
    const { aligner: a, tokenOf } = aligner('إِنَّ الكِتابَ مُفيدٌ جداً للطلاب في المدرسة');
    expect(a.match(heard('ان الكتاب مفيد جدا'), true)).toBe(tokenOf('جداً'));
  });

  it('tolerates skipped and misrecognized words', () => {
    const { aligner: a, tokenOf } = aligner(SCRIPT);
    // «اليومي» skipped, «التقنيه» misheard as «التقني».
    expect(a.match(heard('مرحبا بكم في برنامجنا عن التقني الحديثة'), true)).toBe(tokenOf('الحديثة'));
    // A word the script does not have.
    expect(a.match(heard('نتحدث اليوم يعني عن الذكاء الاصطناعي'), true)).toBe(tokenOf('الاصطناعي'));
  });

  it('prefers the nearest repeat of a phrase ahead', () => {
    const body = [
      'قال المذيع شكراً لكم على المتابعة.',
      'ثم عرضنا التقرير الأول.',
      'قال المذيع شكراً لكم على المتابعة.',
      'وانتهت الحلقة.',
    ].join('\n');
    const { aligner: a, tokenOf } = aligner(body);
    expect(a.match(heard('قال المذيع شكرا لكم'), true)).toBe(tokenOf('لكم', 0));
    expect(a.match(heard('ثم عرضنا التقرير الاول'), true)).toBe(tokenOf('الأول'));
    expect(a.match(heard('قال المذيع شكرا لكم'), true)).toBe(tokenOf('لكم', 1));
  });

  it('never moves back on interim results, only on strong final ones', () => {
    const { aligner: a, tokenOf } = aligner(SCRIPT);
    expect(a.match(heard('ثم ننتقل الى اخبار الهواتف الذكية'), true)).toBe(tokenOf('الذكية'));
    expect(a.match(heard('نتحدث اليوم عن الذكاء الاصطناعي'), false)).toBeNull();
    expect(a.match(heard('نتحدث اليوم عن الذكاء الاصطناعي'), true)).toBe(tokenOf('الاصطناعي'));
  });

  it('handles short utterances just ahead only', () => {
    const { aligner: a, tokenOf } = aligner(SCRIPT);
    a.match(heard('مرحبا بكم في برنامجنا'), true);
    expect(a.match(heard('اليومي عن'), false)).toBe(tokenOf('عن'));
    expect(a.match(heard('الختام'), false)).toBeNull(); // far ahead: ambiguous
  });

  it('finds the speaker again after a jump ahead', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `هذه هي الجملة رقم ${i + 1} في النص الطويل`);
    lines[20] = 'وهنا ننتقل إلى موضوع مختلف تماماً عن كل ما سبق';
    const { aligner: a, tokenOf } = aligner(lines.join('\n'));
    const target = heard('ننتقل الى موضوع مختلف تماما');
    const results = Array.from({ length: 4 }, () => a.match(target, true));
    // Out of the normal window at first; found once the window widens after a few misses.
    expect(results[0]).toBeNull();
    expect(results.at(-1)).toBe(tokenOf('تماماً'));
  });

  it('resyncs after the reader moves', () => {
    const { aligner: a, tokenOf } = aligner(SCRIPT);
    a.resync(tokenOf('وفي'));
    expect(a.match(heard('وفي الختام نستعرض'), false)).toBe(tokenOf('نستعرض'));
  });

  it('matches mixed Arabic and English script words', () => {
    const { aligner: a, tokenOf } = aligner('أطلقت Apple هاتف iPhone الجديد اليوم في مؤتمرها السنوي');
    expect(a.match(heard('اطلقت apple هاتف iphone الجديد'), true)).toBe(tokenOf('الجديد'));
  });
});

describe('VadMachine', () => {
  const run = (vad: VadMachine, db: number, fromMs: number, toMs: number, step = 20) => {
    let speaking = vad.isSpeaking;
    for (let t = fromMs; t < toMs; t += step) speaking = vad.push(db, t);
    return speaking;
  };

  it('learns the background noise and ignores it', () => {
    const vad = new VadMachine({ sensitivityDb: 12 });
    expect(run(vad, -50, 0, 3000)).toBe(false);
    expect(vad.noiseFloor).toBeCloseTo(-50, 0);
  });

  it('starts after the attack time and stops after the release time', () => {
    const vad = new VadMachine({ sensitivityDb: 12, attackMs: 120, releaseMs: 700 });
    run(vad, -55, 0, 2000);
    expect(run(vad, -30, 2000, 2100)).toBe(false); // 100 ms of voice: not yet
    expect(run(vad, -30, 2100, 2200)).toBe(true);
    expect(run(vad, -55, 2200, 2800)).toBe(true); // a pause between words
    expect(run(vad, -55, 2800, 3000)).toBe(false);
  });

  it('ignores short bumps', () => {
    const vad = new VadMachine();
    run(vad, -60, 0, 2000);
    run(vad, -20, 2000, 2060);
    expect(run(vad, -60, 2060, 2400)).toBe(false);
  });

  it('keeps detecting speech when the room gets a little louder', () => {
    const vad = new VadMachine({ sensitivityDb: 10 });
    run(vad, -60, 0, 2000);
    run(vad, -50, 2000, 8000); // new background
    expect(vad.noiseFloor).toBeGreaterThan(-52);
    expect(run(vad, -30, 8000, 8300)).toBe(true);
  });

  it('measures levels in dBFS', () => {
    expect(levelDb(new Float32Array(128).fill(0.5))).toBeCloseTo(-6.02, 1);
    expect(levelDb(new Float32Array(128))).toBe(-100);
  });
});
