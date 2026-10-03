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

/** An explicit font weight wins over the tag: Google Docs wraps every copy in `<b style="font-weight:normal">`. */
function isBold(el: HTMLElement): boolean {
  const weight = el.style?.fontWeight;
  if (weight) return weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
  return el.tagName === 'STRONG' || el.tagName === 'B';
}

function isItalic(el: HTMLElement): boolean {
  const style = el.style?.fontStyle;
  if (style) return style === 'italic' || style === 'oblique';
  return el.tagName === 'EM' || el.tagName === 'I';
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

const BLOCK_SELECTOR = [...BLOCK_TAGS].join(',');

/** A converted block, or `null` for an empty paragraph: a blank line the author typed. */
interface Piece {
  text: string;
  /** The block has an explicit zero top/bottom margin (Google Docs lines), so no gap shows around it. */
  flushTop: boolean;
  flushBottom: boolean;
}

const isZero = (length: string | undefined) => !!length && parseFloat(length) === 0;

function piece(text: string, el?: HTMLElement): Piece {
  return { text, flushTop: isZero(el?.style.marginTop), flushBottom: isZero(el?.style.marginBottom) };
}

function blocks(root: Element, out: (Piece | null)[]): void {
  let buffer = '';
  const flush = () => {
    const text = cleanLines(buffer);
    if (text) out.push(piece(text));
    // Line breaks with no text between blocks are empty paragraphs (Google Docs copies them as <br>).
    else for (let i = buffer.split('\n').length - 1; i > 0; i--) out.push(null);
    buffer = '';
  };

  for (const node of root.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      buffer += inline(node);
      continue;
    }
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (!BLOCK_TAGS.has(tag)) {
      // Inline wrappers around whole paragraphs, such as Google Docs' <b id="docs-internal-guid-…">.
      if (!SKIP_TAGS.has(tag) && el.querySelector(BLOCK_SELECTOR)) {
        flush();
        blocks(el, out);
      } else buffer += inline(el);
      continue;
    }
    flush();
    if (/^H[1-6]$/.test(tag)) {
      const level = Math.min(3, Number(tag[1]));
      const text = cleanLines(inline(el)).replace(/\n/g, ' ');
      if (text) out.push(piece(`${'#'.repeat(level)} ${text}`, el));
    } else if (tag === 'UL' || tag === 'OL') {
      const items = [...el.children].filter((child) => child.tagName === 'LI');
      const lines = items
        .map((item, i) => {
          const text = cleanLines(inline(item)).replace(/\n/g, ' ');
          return text ? `${tag === 'OL' ? `${i + 1}.` : '•'} ${text}` : '';
        })
        .filter(Boolean);
      if (lines.length) out.push(piece(lines.join('\n'), el));
    } else if (tag === 'TABLE') {
      const rows = [...el.querySelectorAll('tr')].map((row) =>
        [...row.children]
          .map((cell) => cleanLines(inline(cell)).replace(/\n/g, ' '))
          .filter(Boolean)
          .join(' · '),
      );
      const text = rows.filter(Boolean).join('\n');
      if (text) out.push(piece(text, el));
    } else if (tag === 'P' || tag === 'LI' || tag === 'PRE') {
      const text = cleanLines(tag === 'PRE' ? escapeText(el.textContent ?? '') : inline(el));
      out.push(text ? piece(text, el) : null);
    } else {
      blocks(el, out);
    }
  }
  flush();
}

/**
 * Joins the blocks so the script keeps the author's line structure. Paragraphs are normally separated
 * by a blank line; documents that space their text with empty paragraphs (a script typed line by line
 * in Word or Google Docs) and paragraphs with no margins become lines of one block instead, and every
 * empty paragraph stays a blank line.
 */
function joinPieces(pieces: (Piece | null)[]): string {
  let boundaries = 0;
  let spaced = 0;
  let started = false;
  let empties = 0;
  for (const p of pieces) {
    if (p === null) {
      if (started) empties++;
      continue;
    }
    if (started) {
      boundaries++;
      if (empties > 0) spaced++;
    }
    started = true;
    empties = 0;
  }
  const spacerLayout = spaced > 0 && spaced * 10 >= boundaries;

  let out = '';
  let previous: Piece | null = null;
  empties = 0;
  for (const p of pieces) {
    if (p === null) {
      if (previous) empties++;
      continue;
    }
    if (previous) {
      const lines = spacerLayout || (previous.flushBottom && p.flushTop) ? empties : 1 + empties;
      out += '\n'.repeat(lines + 1);
    }
    out += p.text;
    previous = p;
    empties = 0;
  }
  return out;
}

export function htmlToMarkup(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: (Piece | null)[] = [];
  blocks(doc.body, out);
  return joinPieces(out);
}

/** True when pasted HTML carries formatting worth converting (otherwise plain text is used). */
export function htmlHasFormatting(html: string): boolean {
  return /<(h[1-6]|strong|b|em|i|mark|li)\b|font-weight:\s*(bold|[6-9]00)|font-style:\s*italic/i.test(html);
}
