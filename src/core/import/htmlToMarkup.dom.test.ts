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
