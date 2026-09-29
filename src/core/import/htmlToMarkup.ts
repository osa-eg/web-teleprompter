/**
 * Converts HTML (from Word via mammoth, or rich text pasted from the clipboard) to teleprompter
 * markup. Uses the inert DOMParser, so no script in the input ever runs.
 */

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'TABLE',
  'TR',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'PRE',
]);
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'IMG',
  'SVG',
  'IFRAME',
  'OBJECT',
  'HEAD',
]);

/** Escapes characters that would otherwise be read as markup. */
function escapeText(text: string): string {
  return text.replace(/([\\*=[\]])/g, '\\$1');
}

function isBold(el: HTMLElement): boolean {
  if (el.tagName === 'STRONG' || el.tagName === 'B') return true;
  const weight = el.style?.fontWeight;
  return weight === 'bold' || Number(weight) >= 600;
}

function isItalic(el: HTMLElement): boolean {
  return el.tagName === 'EM' || el.tagName === 'I' || el.style?.fontStyle === 'italic';
}

function isMark(el: HTMLElement): boolean {
  const background = el.style?.backgroundColor;
  return (
    el.tagName === 'MARK' ||
    (!!background && background !== 'transparent' && background !== 'rgb(255, 255, 255)')
  );
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText((node.textContent ?? '').replace(/\s+/g, ' '));
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (SKIP_TAGS.has(el.tagName)) return '';
  if (el.tagName === 'BR') return '\n';
  let inner = [...el.childNodes].map(inline).join('');
  if (!inner.trim()) return inner;
  const wrap = (marker: string) => {
    const leading = /^\s*/.exec(inner)![0];
    const trailing = /\s*$/.exec(inner)![0];
    inner = `${leading}${marker}${inner.trim()}${marker}${trailing}`;
  };
  if (isMark(el)) wrap('==');
  if (isBold(el)) wrap('**');
  if (isItalic(el)) wrap('*');
  return inner;
}

function cleanLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, i, all) => line || (i > 0 && all[i - 1]))
    .join('\n')
    .trim();
}

function blocks(root: Element, out: string[]): void {
  let buffer = '';
  const flush = () => {
    const text = cleanLines(buffer);
    if (text) out.push(text);
    buffer = '';
  };

  for (const node of root.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName)) {
      flush();
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        const level = Math.min(3, Number(tag[1]));
        const text = cleanLines(inline(el)).replace(/\n/g, ' ');
        if (text) out.push(`${'#'.repeat(level)} ${text}`);
      } else if (tag === 'UL' || tag === 'OL') {
        const items = [...el.children].filter((child) => child.tagName === 'LI');
        const lines = items
          .map((item, i) => {
            const text = cleanLines(inline(item)).replace(/\n/g, ' ');
            return text ? `${tag === 'OL' ? `${i + 1}.` : '•'} ${text}` : '';
          })
          .filter(Boolean);
        if (lines.length) out.push(lines.join('\n'));
      } else if (tag === 'TABLE') {
        const rows = [...el.querySelectorAll('tr')].map((row) =>
          [...row.children]
            .map((cell) => cleanLines(inline(cell)).replace(/\n/g, ' '))
            .filter(Boolean)
            .join(' · '),
        );
        const text = rows.filter(Boolean).join('\n');
        if (text) out.push(text);
      } else if (tag === 'P' || tag === 'LI' || tag === 'PRE') {
        const text = cleanLines(tag === 'PRE' ? escapeText(el.textContent ?? '') : inline(el));
        if (text) out.push(text);
      } else {
        blocks(el, out);
      }
    } else {
      buffer += inline(node);
    }
  }
  flush();
}

export function htmlToMarkup(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];
  blocks(doc.body, out);
  return out.join('\n\n');
}

/** True when pasted HTML carries formatting worth converting (otherwise plain text is used). */
export function htmlHasFormatting(html: string): boolean {
  return /<(h[1-6]|strong|b|em|i|mark|li)\b|font-weight:\s*(bold|[6-9]00)|font-style:\s*italic/i.test(html);
}
