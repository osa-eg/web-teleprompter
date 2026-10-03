import { describe, expect, it } from 'vitest';
import { parseScript } from '../script/parse';
import { htmlHasFormatting, htmlToMarkup } from './htmlToMarkup';

describe('htmlToMarkup', () => {
  it('converts headings, paragraphs and inline formatting', () => {
    const html = `
      <h1>المقدمة</h1>
      <p>مرحباً <strong>بكم</strong> في <em>الحلقة</em> <mark>الجديدة</mark>.</p>
      <h4>Deep heading</h4>
      <p>Line one<br>Line two</p>`;
    expect(htmlToMarkup(html)).toBe(
      '# المقدمة\n\nمرحباً **بكم** في *الحلقة* ==الجديدة==.\n\n### Deep heading\n\nLine one\nLine two',
    );
  });

  it('converts lists and tables', () => {
    const html =
      '<ul><li>أول</li><li>ثانٍ</li></ul><ol><li>one</li><li>two</li></ol><table><tr><td>a</td><td>b</td></tr></table>';
    expect(htmlToMarkup(html)).toBe('• أول\n• ثانٍ\n\n1. one\n2. two\n\na · b');
  });

  it('understands Google Docs style spans', () => {
    const html =
      '<p><span style="font-weight:700">Bold</span> and <span style="font-style:italic">italic</span></p>';
    expect(htmlToMarkup(html)).toBe('**Bold** and *italic*');
  });

  it('keeps the lines and blank lines of a Google Docs copy', () => {
    const line = (text: string) =>
      `<p dir="rtl" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-weight:400;">${text}</span></p>`;
    const html =
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b">' +
      `${line('قبل ما تدفع ريال واحد')}${line('<span style="font-weight:700">على تطبيقك…</span>')}<br>` +
      `${line('فيه 7 أسئلة')}<br><br>${line('مهم جدًا')}</b><br class="Apple-interchange-newline">`;
    expect(htmlToMarkup(html)).toBe('قبل ما تدفع ريال واحد\n**على تطبيقك…**\n\nفيه 7 أسئلة\n\n\nمهم جدًا');
  });

  it('turns empty paragraphs into blank lines when a document is spaced with them', () => {
    const html = '<p>سطر أول</p><p>سطر تاني</p><p>&nbsp;</p><p>فقرة جديدة</p><p></p><p></p><p>أخيرة</p>';
    expect(htmlToMarkup(html)).toBe('سطر أول\nسطر تاني\n\nفقرة جديدة\n\n\nأخيرة');
  });

  it('keeps paragraphs apart when a stray empty paragraph does not space the document', () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => `<p>p${i}</p>`);
    paragraphs.splice(6, 0, '<p></p>');
    const markup = htmlToMarkup(paragraphs.join(''));
    expect(markup.split('\n\n')).toHaveLength(12);
    expect(markup).toContain('p5\n\n\np6');
  });

  it('keeps the blank lines of editors that write lines as <div>', () => {
    expect(htmlToMarkup('<div>one</div><div>two</div><div><br></div><div>three</div>')).toBe(
      'one\ntwo\n\nthree',
    );
  });

  it('lets an explicit font weight or style win over the tag', () => {
    expect(
      htmlToMarkup('<p><b style="font-weight:normal">plain</b> <i style="font-style:normal">x</i></p>'),
    ).toBe('plain x');
  });

  it('escapes characters that would become markup', () => {
    const markup = htmlToMarkup('<p>2 * 3 = 6 and [pause] stays literal</p>');
    expect(markup).toBe('2 \\* 3 \\= 6 and \\[pause\\] stays literal');
    const doc = parseScript(markup);
    expect(doc.cues).toHaveLength(0);
  });

  it('ignores scripts, styles and images', () => {
    expect(
      htmlToMarkup('<p>safe<script>alert(1)</script><img src=x onerror=alert(1)></p><style>p{}</style>'),
    ).toBe('safe');
  });

  it('detects formatting worth converting', () => {
    expect(htmlHasFormatting('<p><b>x</b></p>')).toBe(true);
    expect(htmlHasFormatting('<span style="font-weight: 700">x</span>')).toBe(true);
    expect(htmlHasFormatting('<p>plain</p>')).toBe(false);
  });
});
