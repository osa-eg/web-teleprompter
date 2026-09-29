import { describe, expect, it } from 'vitest';
import { base64ToBuffer, bufferToBase64, createBackup, parseBackup } from './backup';
import { convertPresentationForms, joinWrappedLines, normalizeSpaces, removeDirectionMarks } from './cleanup';
import { markdownToMarkup } from './markdown';
import { decodeText, titleFromFileName } from './text';

const cp = (...codes: number[]) => String.fromCodePoint(...codes);

describe('decodeText', () => {
  it('reads UTF-8 with and without a BOM', () => {
    const utf8 = new TextEncoder().encode('مرحبا Hello');
    expect(decodeText(utf8)).toEqual({ text: 'مرحبا Hello', encoding: 'utf-8' });
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8])).text).toBe('مرحبا Hello');
  });

  it('reads UTF-16 with a BOM', () => {
    const le = new Uint8Array([0xff, 0xfe, 0x45, 0x06, 0x31, 0x06]); // م ر
    expect(decodeText(le)).toEqual({ text: 'مر', encoding: 'utf-16le' });
    const be = new Uint8Array([0xfe, 0xff, 0x06, 0x45, 0x06, 0x31]);
    expect(decodeText(be)).toEqual({ text: 'مر', encoding: 'utf-16be' });
  });

  it('falls back to Windows-1256 for legacy Arabic files', () => {
    const cp1256 = new Uint8Array([0xe3, 0xd1, 0xcd, 0xc8, 0xc7, 0x20, 0x62, 0xed]); // "مرحبا bي"
    const decoded = decodeText(cp1256);
    expect(decoded.encoding).toBe('windows-1256');
    expect(decoded.text).toBe('مرحبا bي');
  });

  it('derives titles from file names', () => {
    expect(titleFromFileName('خطاب_الافتتاح.txt')).toBe('خطاب الافتتاح');
    expect(titleFromFileName('script.v2.md')).toBe('script.v2');
  });
});

describe('cleanup tools', () => {
  it('converts presentation forms but keeps word ligatures', () => {
    const marhaba = cp(0xfee3, 0xfeae, 0xfea3, 0xfe92, 0xfe8e);
    expect(convertPresentationForms(marhaba)).toBe('مرحبا');
    expect(convertPresentationForms(cp(0xfefb))).toBe('لا');
    const salla = cp(0xfdfa);
    expect(convertPresentationForms(`محمد ${salla}`)).toBe(`محمد ${salla}`);
  });

  it('removes direction marks and control characters', () => {
    expect(
      removeDirectionMarks(`${cp(0x200f)}نص ${cp(0x202b)}مضمن${cp(0x202c)} ${cp(0x2067)}x${cp(0x2069)}`),
    ).toBe('نص مضمن x');
  });

  it('normalizes spaces and blank lines', () => {
    expect(normalizeSpaces(`a${cp(0xa0)}b   c  \n\n\n\nd\t\te`)).toBe('a b c\n\nd e');
  });

  it('joins hand-wrapped lines inside paragraphs', () => {
    const text = 'هذا سطر مقطوع\nفي منتصف الجملة.\nسطر جديد\n\n# عنوان\nنص';
    expect(joinWrappedLines(text)).toBe('هذا سطر مقطوع في منتصف الجملة.\nسطر جديد\n\n# عنوان\nنص');
  });
});

describe('markdownToMarkup', () => {
  it('keeps headings and emphasis and simplifies the rest', () => {
    const md = [
      '---',
      'title: x',
      '---',
      'Title',
      '=====',
      '#### Deep',
      '> quoted __bold__ text with [a link](https://x.y) and `code`',
      '- item one',
      '* [x] done',
      '![image](pic.png)',
      '```',
      'raw **code**',
      '```',
      '***',
      'end',
    ].join('\n');
    expect(markdownToMarkup(md)).toBe(
      [
        '# Title',
        '### Deep',
        'quoted **bold** text with a link and code',
        '• item one',
        '• done',
        '',
        'raw **code**',
        '',
        'end',
      ].join('\n'),
    );
  });
});

describe('backups', () => {
  const script = {
    id: 'a',
    title: 'نص',
    body: 'مرحبا',
    direction: 'auto' as const,
    createdAt: 1,
    updatedAt: 2,
  };

  it('round-trips through JSON', () => {
    const backup = createBackup([script], { ui: { lang: 'ar' } });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok && parsed.backup.scripts).toEqual([script]);
    expect(parsed.ok && parsed.backup.settings).toEqual({ ui: { lang: 'ar' } });
  });

  it('rejects other files', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'json' });
    expect(parseBackup('{"app":"other","version":1}')).toEqual({ ok: false, error: 'format' });
    expect(parseBackup(JSON.stringify({ ...createBackup([script]), version: 99 }))).toEqual({
      ok: false,
      error: 'format',
    });
  });

  it('encodes binary font data as base64', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    expect(new Uint8Array(base64ToBuffer(bufferToBase64(bytes.buffer)))).toEqual(bytes);
  });
});
