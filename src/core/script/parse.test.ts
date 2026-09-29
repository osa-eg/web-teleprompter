import { describe, expect, it } from 'vitest';
import type { Block, Inline, ScriptDoc } from './ast';
import { parseScript, plainText } from './parse';

const para = (doc: ScriptDoc, i = 0) => {
  const block = doc.blocks[i];
  if (block?.t !== 'para') throw new Error(`block ${i} is ${block?.t}`);
  return block;
};
const firstLine = (doc: ScriptDoc, i = 0): Inline[] => para(doc, i).lines[0]!.c;
const kinds = (inlines: Inline[]) => inlines.map((n) => n.t);
const words = (doc: ScriptDoc) => doc.tokens.filter((t) => t.kind === 'word').map((t) => t.text);

describe('blocks', () => {
  it('splits paragraphs on blank lines and keeps each line separate', () => {
    const doc = parseScript('one two\nthree\n\n\nfour');
    expect(doc.blocks.map((b) => b.t)).toEqual(['para', 'para']);
    expect(para(doc, 0).lines).toHaveLength(2);
    expect(para(doc, 1).lines).toHaveLength(1);
  });

  it('treats whitespace-only lines as blank', () => {
    expect(parseScript('a\n   \t\nb').blocks).toHaveLength(2);
  });

  it('normalizes CRLF, CR and a byte-order mark', () => {
    const doc = parseScript(String.fromCodePoint(0xfeff) + 'a\r\nb\rc');
    expect(para(doc).lines).toHaveLength(3);
    expect(words(doc)).toEqual(['a', 'b', 'c']);
  });

  it('parses headings as markers', () => {
    const doc = parseScript('# المقدمة\nنص\n\n## Part **two**\n\n### Three');
    expect(doc.blocks.map((b) => b.t)).toEqual(['heading', 'para', 'heading', 'heading']);
    expect(doc.markers.map((m) => [m.title, m.level])).toEqual([
      ['المقدمة', 1],
      ['Part two', 2],
      ['Three', 3],
    ]);
    expect(doc.markers[1]!.block).toBe(2);
  });

  it('requires a space after # and at most three #', () => {
    const doc = parseScript('#hashtag\n\n#### four');
    expect(doc.blocks.every((b) => b.t === 'para')).toBe(true);
    expect(doc.markers).toHaveLength(0);
  });

  it('counts heading words separately from spoken words', () => {
    const doc = parseScript('# One two\n\nthree four five');
    expect(doc.stats).toMatchObject({ words: 3, headingWords: 2 });
    expect(doc.tokens.map((t) => t.kind)).toEqual(['heading', 'heading', 'word', 'word', 'word']);
  });

  it('points a word-less heading marker at the next token', () => {
    const doc = parseScript('# ***\n\nhello');
    expect(doc.markers[0]!.token).toBe(0);
    expect(doc.tokens[0]!.text).toBe('hello');
  });

  it('records source ranges', () => {
    const body = '# T\n\nline a\nline b';
    const doc = parseScript(body);
    const [heading, paragraph] = doc.blocks as [Block, Block];
    expect(body.slice(...heading.src)).toBe('# T');
    expect(body.slice(...paragraph.src)).toBe('line a\nline b');
  });
});

describe('cues', () => {
  it('parses standalone cue lines as cue blocks', () => {
    const doc = parseScript('a\n[pause]\nb');
    expect(doc.blocks.map((b) => b.t)).toEqual(['para', 'cue', 'para']);
    expect(doc.cues).toEqual([{ block: 1, token: 1, seconds: undefined }]);
  });

  it.each([
    ['[pause]', undefined],
    ['[PAUSE 3]', 3],
    ['[pause 2s]', 2],
    ['[pause 1.5 sec]', 1.5],
    ['[wait 4 seconds]', 4],
    ['[توقف]', undefined],
    ['[توقف 2]', 2],
    ['[وقفة ٣]', 3],
    ['[وقفة ٢ث]', 2],
    ['[انتظر ١٠ ثوان]', 10],
    ['[ pause 5 ]', 5],
  ])('%s → %s seconds', (source, seconds) => {
    const doc = parseScript(source);
    expect(doc.cues).toHaveLength(1);
    expect(doc.cues[0]!.seconds).toBe(seconds);
  });

  it('parses inline cues as zero-width positional tokens', () => {
    const doc = parseScript('first [pause] second');
    expect(kinds(firstLine(doc))).toEqual(['text', 'cue', 'text']);
    expect(doc.tokens.map((t) => t.kind)).toEqual(['word', 'cue', 'word']);
    expect(doc.stats.words).toBe(2);
  });

  it('keeps other bracketed text literal', () => {
    const doc = parseScript('see [appendix] and [pause now]');
    expect(doc.cues).toHaveLength(0);
    expect(plainText(firstLine(doc))).toBe('see [appendix] and [pause now]');
  });
});

describe('inline markup', () => {
  it('parses strong, em and highlight', () => {
    const doc = parseScript('**bold** *em* _em2_ ==mark==');
    expect(kinds(firstLine(doc))).toEqual(['strong', 'text', 'em', 'text', 'em', 'text', 'mark']);
  });

  it('nests formatting', () => {
    const doc = parseScript('**bold *and em***');
    const [strong] = firstLine(doc);
    expect(strong?.t).toBe('strong');
    expect(strong && 'c' in strong ? kinds(strong.c) : []).toEqual(['text', 'em']);
  });

  it('leaves unclosed delimiters literal', () => {
    expect(plainText(firstLine(parseScript('**not closed')))).toBe('**not closed');
    expect(plainText(firstLine(parseScript('==half')))).toBe('==half');
    expect(plainText(firstLine(parseScript('a * b')))).toBe('a * b');
  });

  it('does not treat spaced asterisks as emphasis', () => {
    const doc = parseScript('2 * 3 * 4');
    expect(kinds(firstLine(doc))).toEqual(['text']);
  });

  it('ignores intraword underscores', () => {
    const doc = parseScript('snake_case_name');
    expect(kinds(firstLine(doc))).toEqual(['text']);
  });

  it('supports escapes', () => {
    const doc = parseScript(String.raw`\*literal\* \[pause\] \# \\ \==`);
    expect(plainText(firstLine(doc))).toBe(String.raw`*literal* [pause] # \ ==`);
    expect(doc.cues).toHaveLength(0);
  });

  it('parses notes that are neither spoken nor positional', () => {
    const doc = parseScript('[[Look at camera]] مرحبا بكم');
    const line = firstLine(doc);
    expect(kinds(line)).toEqual(['note', 'text']);
    expect(words(doc)).toEqual(['مرحبا', 'بكم']);
    expect(doc.stats.words).toBe(2);
  });

  it('allows formatting inside notes', () => {
    const [note] = firstLine(parseScript('[[**camera 2**]]'));
    expect(note?.t).toBe('note');
    expect(note && 'c' in note ? kinds(note.c) : []).toEqual(['strong']);
  });

  it('keeps an unclosed note literal', () => {
    expect(plainText(firstLine(parseScript('[[open note')))).toBe('[[open note');
  });

  it('does not let emphasis close inside a note', () => {
    const doc = parseScript('*a [[b* c]] d*');
    const [em] = firstLine(doc);
    expect(em?.t).toBe('em');
  });

  it('treats a lone equals sign as text', () => {
    expect(kinds(firstLine(parseScript('a = b')))).toEqual(['text']);
  });
});

describe('tokens', () => {
  it('tokenizes Arabic words with attached clitics and punctuation', () => {
    const doc = parseScript('وَالكِتابُ، مُفيدٌ!');
    expect(words(doc)).toEqual(['وَالكِتابُ', 'مُفيدٌ']);
  });

  it('numbers tokens contiguously in document order', () => {
    const doc = parseScript(
      '# Title here\n\none **two** [pause] ==three==\n\n[[note]] four\n\n[توقف 2]\n\nfive',
    );
    expect(doc.tokens.map((t) => t.i)).toEqual(doc.tokens.map((_, i) => i));
    const partsW: number[] = [];
    const walk = (nodes: Inline[]) => {
      for (const n of nodes) {
        if (n.t === 'text') for (const p of n.parts) if (typeof p !== 'string') partsW.push(p.w);
        if (n.t === 'cue') partsW.push(n.w);
        if ('c' in n) walk(n.c);
      }
    };
    for (const b of doc.blocks) {
      if (b.t === 'heading') walk(b.line.c);
      if (b.t === 'para') for (const l of b.lines) walk(l.c);
      if (b.t === 'cue') partsW.push(b.w);
    }
    expect(partsW).toEqual(doc.tokens.map((t) => t.i));
  });

  it('assigns tokens to their block', () => {
    const doc = parseScript('a b\n\nc');
    expect(doc.tokens.map((t) => t.block)).toEqual([0, 0, 1]);
  });

  it('counts visible characters without markup or spaces', () => {
    expect(parseScript('**ab** cd [[e]]').stats.chars).toBe(5);
  });
});

describe('direction', () => {
  it('detects each line independently in auto mode', () => {
    const doc = parseScript('iPhone 17 هو أحدث هاتف\nWelcome to the show\n2026');
    expect(para(doc).lines.map((l) => l.dir)).toEqual(['rtl', 'ltr', 'ltr']);
  });

  it('computes the dominant direction from all words', () => {
    expect(parseScript('مرحبا بكم جميعا\nHello').dominantDir).toBe('rtl');
    expect(parseScript('Hello there friends\nمرحبا').dominantDir).toBe('ltr');
  });

  it('uses the fallback for scripts without letters', () => {
    expect(parseScript('123', { fallbackDir: 'rtl' }).dominantDir).toBe('rtl');
    expect(parseScript('123').dominantDir).toBe('ltr');
  });

  it('forces every line when a direction is set', () => {
    const doc = parseScript('Hello\nمرحبا', { direction: 'rtl' });
    expect(para(doc).lines.map((l) => l.dir)).toEqual(['rtl', 'rtl']);
    expect(doc.dominantDir).toBe('rtl');
    expect(parseScript('مرحبا', { direction: 'ltr' }).dominantDir).toBe('ltr');
  });

  it('lets cue blocks inherit the previous direction', () => {
    const doc = parseScript('مرحبا بكم\n[pause]');
    const cue = doc.blocks[1];
    expect(cue?.t === 'cue' && cue.dir).toBe('rtl');
  });
});

describe('performance', () => {
  it('parses 10k words quickly', () => {
    const line = 'مرحباً بكم في **الملقّن** مع كلمات كثيرة Hello world [pause] ==تظليل== [[ملاحظة]]\n';
    const body = line.repeat(1000);
    const start = performance.now();
    const doc = parseScript(body);
    const elapsed = performance.now() - start;
    expect(doc.stats.words).toBeGreaterThan(9000);
    expect(elapsed).toBeLessThan(500);
  });
});
